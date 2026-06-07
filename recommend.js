// ==== 미개척지 탐색 (Frontier & POI 필터링) 기능 ====
const recommendGroup = L.featureGroup().addTo(map);
const activePathsGroup = L.featureGroup().addTo(map); // 클릭 시 뻗어나가는 길을 담을 그룹

// 뻗어나간 길을 다시 집어넣는 함수
function retractActivePaths() {
  if (activePathsGroup.getLayers().length > 0) {
    activePathsGroup.eachLayer((layer) => {
      if (layer._path) {
        layer._path.classList.remove('path-extend-anim');
        layer._path.classList.add('path-retract-anim');
      }
    });
    if (window._currentGradUpdater) {
      map.off('zoom', window._currentGradUpdater);
      window._currentGradUpdater = null;
    }
    setTimeout(() => {
      activePathsGroup.clearLayers();
    }, 4000); // CSS 애니메이션 시간(4.0s)이 끝난 후 레이어 삭제
  }
}

// 지도 빈 공간 클릭 시, 뻗어나갔던 길들이 다시 들어가는(Retract) 효과
map.on('click', retractActivePaths);
// 팝업 창(말풍선)을 닫았을 때도 동일한 효과 적용
map.on('popupclose', retractActivePaths);
let isRecommendMode = false;

// 가상 타일(Grid) 크기 설정 (약 300m x 300m 블록)
const GRID_SIZE = 0.003;

function getGrid(lat, lng) {
  return { x: Math.floor(lat / GRID_SIZE), y: Math.floor(lng / GRID_SIZE) };
}

function getGridBounds(x, y) {
  return [
    [x * GRID_SIZE, y * GRID_SIZE],
    [(x + 1) * GRID_SIZE, (y + 1) * GRID_SIZE],
  ];
}

window.toggleRecommendMode = function () {
  const defaultView = document.getElementById('default-view');
  const recommendView = document.getElementById('recommend-view');

  if (isRecommendMode) {
    // 일반 지도 모드로 복귀
    isRecommendMode = false;
    recommendGroup.clearLayers();
    if (window._currentGradUpdater) {
      map.off('zoom', window._currentGradUpdater);
      window._currentGradUpdater = null;
    }
    activePathsGroup.clearLayers();
    markerGroup.addTo(map);
    defaultView.classList.remove('view-hidden');
    recommendView.classList.add('view-hidden');
    window.showToast('일반 지도 모드로 돌아왔습니다.');
  } else {
    // 탐색 UI로 전환
    isRecommendMode = true;
    recommendGroup.clearLayers();
    if (window._currentGradUpdater) {
      map.off('zoom', window._currentGradUpdater);
      window._currentGradUpdater = null;
    }
    activePathsGroup.clearLayers();
    defaultView.classList.add('view-hidden');
    recommendView.classList.remove('view-hidden');
    window.showToast('찾을 장소를 선택하고 탐색을 시작하세요.');
  }
};

window.startRecommendSearch = async function () {
  if (window.savedLocations.length === 0) {
    alert('먼저 방문 기록(사진)을 업로드해주세요!');
    return;
  }
  if (map.getZoom() < 13) {
    alert(
      '탐색 범위가 너무 넓습니다. 지도를 조금 더 확대한 후 다시 시도해주세요.',
    );
    return;
  }

  // 체크된 카테고리 수집
  const checkboxes = document.querySelectorAll('.poi-filter:checked');
  const selectedTypes = Array.from(checkboxes).map((cb) => cb.value);
  if (selectedTypes.length === 0) {
    alert('최소 하나의 장소 유형을 선택해주세요.');
    return;
  }

  recommendGroup.clearLayers();
  if (window._currentGradUpdater) {
    map.off('zoom', window._currentGradUpdater);
    window._currentGradUpdater = null;
  }
  activePathsGroup.clearLayers();
  window.showToast('🔍 미개척지를 분석하여 선택한 장소들을 찾는 중...');

  // 1. 프론티어 (인접 타일) 계산
  const visited = new Set();
  window.savedLocations.forEach((loc) => {
    const g = getGrid(loc.lat, loc.lng);
    visited.add(`${g.x},${g.y}`);
  });

  const bounds = map.getBounds();
  const frontiers = new Map();
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];

  window.savedLocations.forEach((loc) => {
    if (!bounds.contains([loc.lat, loc.lng])) return;
    const g = getGrid(loc.lat, loc.lng);
    directions.forEach((d) => {
      const nx = g.x + d[0];
      const ny = g.y + d[1];
      const key = `${nx},${ny}`;
      if (!visited.has(key) && !frontiers.has(key)) {
        frontiers.set(key, { x: nx, y: ny, bounds: getGridBounds(nx, ny) });
      }
    });
  });

  if (frontiers.size === 0) {
    alert(
      '현재 화면 주변에 인접한 미개척지 타일이 없습니다. 화면을 이동한 뒤 다시 시도해보세요.',
    );
    return;
  }

  // 2. 동적 쿼리 생성
  const s = bounds.getSouth(),
    w = bounds.getWest(),
    n = bounds.getNorth(),
    e = bounds.getEast();
  let reqs = [];
  if (selectedTypes.includes('restaurant'))
    reqs.push('node["amenity"="restaurant"]');
  if (selectedTypes.includes('cafe')) reqs.push('node["amenity"="cafe"]');
  if (selectedTypes.includes('bakery')) reqs.push('node["shop"="bakery"]');
  if (selectedTypes.includes('bar')) reqs.push('node["amenity"~"bar|pub"]');
  if (selectedTypes.includes('park'))
    reqs.push('node["leisure"~"park|garden"]');
  if (selectedTypes.includes('culture')) {
    reqs.push('node["tourism"~"museum|gallery"]');
    reqs.push('node["amenity"="arts_centre"]');
  }
  if (selectedTypes.includes('mall')) reqs.push('node["shop"="mall"]');
  if (selectedTypes.includes('supermarket'))
    reqs.push('node["shop"="supermarket"]');
  if (selectedTypes.includes('convenience'))
    reqs.push('node["shop"="convenience"]');
  if (selectedTypes.includes('shop')) reqs.push('node["shop"]'); // 모든 상점 검색 후 클라이언트 필터링

  const query = `
    [out:json][timeout:20][bbox:${s},${w},${n},${e}];
    (
      ${reqs.join(';')};
    );
    out body;
  `;

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    );
    const data = await res.json();
    const validFrontiers = new Map();

    data.elements.forEach((poi) => {
      if (!poi.lat || !poi.lon) return;
      const tags = poi.tags || {};
      let matchedType = null;

      // 카테고리 매핑
      if (tags.amenity === 'restaurant' && selectedTypes.includes('restaurant'))
        matchedType = '레스토랑';
      else if (tags.amenity === 'cafe' && selectedTypes.includes('cafe'))
        matchedType = '카페';
      else if (tags.shop === 'bakery' && selectedTypes.includes('bakery'))
        matchedType = '베이커리';
      else if (
        (tags.amenity === 'bar' || tags.amenity === 'pub') &&
        selectedTypes.includes('bar')
      )
        matchedType = '술집/바';
      else if (
        (tags.leisure === 'park' || tags.leisure === 'garden') &&
        selectedTypes.includes('park')
      )
        matchedType = '공원/휴식';
      else if (
        (tags.tourism === 'museum' ||
          tags.tourism === 'gallery' ||
          tags.amenity === 'arts_centre') &&
        selectedTypes.includes('culture')
      )
        matchedType = '문화/예술';
      else if (tags.shop === 'mall' && selectedTypes.includes('mall'))
        matchedType = '쇼핑몰';
      else if (
        tags.shop === 'supermarket' &&
        selectedTypes.includes('supermarket')
      )
        matchedType = '마트';
      else if (
        tags.shop === 'convenience' &&
        selectedTypes.includes('convenience')
      )
        matchedType = '편의점';
      else if (
        tags.shop &&
        selectedTypes.includes('shop') &&
        !['mall', 'supermarket', 'convenience', 'bakery'].includes(tags.shop)
      )
        matchedType = '상점';

      if (!matchedType) return;

      const g = getGrid(poi.lat, poi.lon);
      const key = `${g.x},${g.y}`;

      if (frontiers.has(key)) {
        if (!validFrontiers.has(key))
          validFrontiers.set(key, { ...frontiers.get(key), pois: [] });
        validFrontiers.get(key).pois.push({
          lat: poi.lat,
          lon: poi.lon,
          name: tags.name || tags.brand || '이름 없음',
          type: matchedType,
        });
      }
    });

    if (validFrontiers.size === 0) {
      window.showToast('미개척지 영역 내에 조건에 맞는 장소가 없습니다.');
      return;
    }

    window.showToast(
      `✨ ${validFrontiers.size}개의 블록에서 조건에 맞는 장소를 찾았습니다!`,
    );

    let resultBounds = L.latLngBounds();
    const emojiMap = {
      레스토랑: '🍽️',
      카페: '☕',
      베이커리: '🥐',
      '술집/바': '🍻',
      '공원/휴식': '🌳',
      '문화/예술': '🎨',
      쇼핑몰: '🏬',
      마트: '🛒',
      편의점: '🏪',
      상점: '🛍️',
    };

    validFrontiers.forEach((tile) => {
      // 타일 중앙에 테두리 없는 반투명한 원 그리기
      const tileCenter = L.latLngBounds(tile.bounds).getCenter();
      L.circle(tileCenter, {
        radius: 200, // 약 200m 반경 (그리드 크기에 맞춤)
        stroke: false, // 테두리 선 없음
        fillColor: '#9370db',
        fillOpacity: 0.4, // 블러로 인해 테두리가 옅어지므로 중심부 불투명도를 살짝 올림
        className: 'frontier-circle-blur', // 흐림 효과를 위한 커스텀 클래스
      }).addTo(recommendGroup);

      // 항목별로 이모지 핑(마커) 찍기
      tile.pois.forEach((poi) => {
        const emoji = emojiMap[poi.type] || '📍';
        const poiIcon = L.divIcon({
          html: `<div style="font-size: 22px; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4));">${emoji}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const m = L.marker([poi.lat, poi.lon], { icon: poiIcon }).addTo(
          recommendGroup,
        );
        m.bindPopup(`
          <div style="text-align: center; min-width: 130px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">${poi.name}</div>
            <div style="font-size: 11px; color: #888; margin-bottom: 10px;">${emoji} ${poi.type}</div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}" target="_blank" style="display: block; background-color: #4285F4; color: white; text-decoration: none; padding: 6px; border-radius: 6px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🗺️ 구글맵 길찾기</a>
          </div>
        `);

        // ==== 핑(장소) 클릭 시 주변 길 뻗어나가는 애니메이션 ====
        m.on('click', async () => {
          activePathsGroup.clearLayers(); // 기존 그려진 길이 있다면 초기화

          const pathQuery = `
            [out:json][timeout:10];
            way(around:50, ${poi.lat}, ${poi.lon})["highway"~"residential|living_street|pedestrian|footway|path|service|unclassified"];
            out geom;
          `;
          try {
            const res = await fetch(
              `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(pathQuery)}`,
            );
            const pathData = await res.json();

            pathData.elements.forEach((el) => {
              if (el.type === 'way' && el.geometry) {
                const latlngs = el.geometry.map((pt) => [pt.lat, pt.lon]);
                L.polyline(latlngs, {
                  color: 'url(#marker-fade-grad)', // 중앙에서 멀어질수록 투명해지는 그라데이션 적용
                  weight: 4,
                  opacity: 1, // 투명도는 그라데이션에서 제어하므로 1로 고정
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'path-extend-anim', // 뻗어나가는 애니메이션 클래스 적용
                }).addTo(activePathsGroup);
              }
            });

            // 폴리라인이 추가되어 SVG 렌더러가 활성화된 후 그라데이션 속성 동적 주입
            const renderer = map.getRenderer(map);
            if (renderer && renderer._container) {
              const svg = renderer._container;
              let defs = svg.querySelector('defs');
              if (!defs) {
                defs = document.createElementNS(
                  'http://www.w3.org/2000/svg',
                  'defs',
                );
                svg.prepend(defs);
              }
              let radGrad = defs.querySelector('#marker-fade-grad');
              if (!radGrad) {
                radGrad = document.createElementNS(
                  'http://www.w3.org/2000/svg',
                  'radialGradient',
                );
                radGrad.setAttribute('id', 'marker-fade-grad');
                radGrad.setAttribute('gradientUnits', 'userSpaceOnUse'); // 지도 좌표계 연동 설정
                radGrad.innerHTML = `
                  <stop offset="0%" stop-color="#ff69b4" stop-opacity="1" />
                  <stop offset="40%" stop-color="#ff69b4" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#ff69b4" stop-opacity="0" />
                `;
                defs.appendChild(radGrad);
              }

              const updateGrad = () => {
                const pt = map.latLngToLayerPoint([poi.lat, poi.lon]);
                radGrad.setAttribute('cx', pt.x);
                radGrad.setAttribute('cy', pt.y);
                // 줌 레벨에 비례하여 그라데이션 반경(r) 조절 (줌 15 기준 약 120px 반경)
                const scale = Math.pow(2, map.getZoom() - 15);
                radGrad.setAttribute('r', 120 * scale);
              };
              updateGrad();
              window._currentGradUpdater = updateGrad;
              map.on('zoom', window._currentGradUpdater);
            }
          } catch (err) {
            console.error('주변 길 탐색 실패:', err);
          }
        });
        resultBounds.extend([poi.lat, poi.lon]);
      });
      resultBounds.extend(tile.bounds);
    });

    map.flyToBounds(resultBounds, { padding: [50, 50], duration: 1.5 });
  } catch (err) {
    console.error('POI 검색 실패:', err);
    window.showToast('장소를 불러오는 중 오류가 발생했습니다.');
  }
};
