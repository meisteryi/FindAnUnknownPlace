const bounds = [
  [24.0, 122.0], // 오키나와/대만 근처 (남서쪽 끝)
  [46.0, 146.0], // 홋카이도 북동쪽 끝
];

const map = L.map('map', {
  maxBounds: bounds,
  maxBoundsViscosity: 1.0,
  minZoom: 5,
}).setView([37.5665, 126.978], 11);

L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  maxZoom: 22,
  maxNativeZoom: 22,
  attribution: '&copy; Google Maps',
  crossOrigin: true,
}).addTo(map);

// 우측 상단에 장소 검색(돋보기) 컨트롤 추가
L.Control.geocoder({
  position: 'topright',
  placeholder: '🔍 장소 또는 주소 검색...',
}).addTo(map);

// 모든 하위 메뉴를 닫는 헬퍼 함수
window.closeAllSubCities = function () {
  document.querySelectorAll('.sub-button-group').forEach((el) => {
    el.classList.remove('open');
  });
};

window.moveToCity = function (lat, lng, zoom) {
  window.closeAllSubCities(); // 다른 일반 도시 클릭 시 열려있는 하위 메뉴 모두 닫기
  map.flyTo([lat, lng], zoom, { duration: 1.5 });
};

// 하위 메뉴 내의 동네(예: 신주쿠, 강남) 클릭 시 (메뉴는 닫지 않고 지도만 이동)
window.moveToSubCity = function (lat, lng, zoom) {
  map.flyTo([lat, lng], zoom, { duration: 1.5 });
};

window.toggleSubCity = function (id, lat, lng, zoom) {
  map.flyTo([lat, lng], zoom, { duration: 1.5 });

  const subMenu = document.getElementById(id);
  const isCurrentlyOpen = subMenu && subMenu.classList.contains('open');

  // 다른 하위 메뉴들은 일단 닫기
  window.closeAllSubCities();

  // 클릭한 메뉴가 닫혀있었다면 열어주기 (토글 효과)
  if (subMenu && !isCurrentlyOpen) {
    subMenu.classList.add('open');
  }
};

// 클릭한 도시/동네 버튼 활성화 상태(색상) 변경 로직
document.addEventListener('click', function (e) {
  // city-section 영역 안의 city-btn을 클릭했을 때만 동작
  if (
    e.target.classList.contains('city-btn') &&
    e.target.closest('.city-section')
  ) {
    document
      .querySelectorAll('.city-section .city-btn')
      .forEach((btn) => btn.classList.remove('active-city'));
    e.target.classList.add('active-city');

    // 하위 동네 버튼(sub-btn)을 클릭했다면, 부모 도시 버튼도 같이 파란색으로 활성화
    if (e.target.classList.contains('sub-btn')) {
      const subGroup = e.target.closest('.sub-button-group');
      if (subGroup && subGroup.id) {
        const parentBtn = document.querySelector(
          `button[onclick*="'${subGroup.id}'"]`,
        );
        if (parentBtn) parentBtn.classList.add('active-city');
      }
    }
  }
});

const greenDotIcon = L.divIcon({
  className: 'green-dot-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// 마커 클러스터링 적용 (Leaflet.markercluster 플러그인이 로드된 경우)
const markerGroup =
  typeof L.markerClusterGroup === 'function'
    ? L.markerClusterGroup({
        chunkedLoading: true, // 대량의 마커를 부드럽게 렌더링
        spiderfyOnMaxZoom: false, // 겹친 마커를 흩뿌리지 않고 모아서 보여주기 위해 비활성화
        showCoverageOnHover: false, // 마우스 오버 시 클러스터 바운더리(폴리곤 영역) 숨김
        zoomToBoundsOnClick: false, // 클러스터 클릭 이벤트를 수동으로 제어하기 위해 비활성화
      }).addTo(map)
    : L.layerGroup().addTo(map);

if (typeof L.markerClusterGroup === 'function') {
  markerGroup.on('clusterclick', function (a) {
    const currentZoom = map.getZoom();
    const cluster = a.layer;

    // 줌 레벨이 16 이상이거나, 마커들이 완전히 겹쳐서 더 이상 풀어지지 않을 때
    if (currentZoom >= 16) {
      const markers = cluster.getAllChildMarkers();
      let combinedHTML =
        '<div style="max-height: 250px; overflow-y: auto; overflow-x: hidden; padding: 4px;">';

      markers.forEach((m, idx) => {
        combinedHTML += m.getPopup().getContent();
        if (idx < markers.length - 1) {
          combinedHTML +=
            '<hr style="border: 0; border-top: 1px dashed #ccc; margin: 12px 0;" />';
        }
      });
      combinedHTML += '</div>';

      L.popup({ offset: [0, -10] })
        .setLatLng(cluster.getLatLng())
        .setContent(combinedHTML)
        .openOn(map);

      map.flyTo(cluster.getLatLng(), Math.max(currentZoom, 16), {
        duration: 1.0,
      });
    } else {
      // 확대가 충분하지 않으면 해당 클러스터 영역으로 줌인 (기본 동작 재현)
      cluster.zoomToBounds({ padding: [50, 50] });
    }
  });
}

window.activeHistoryMarker = null;
window.currentLocationMarker = null;

window.showToast = function (message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('toast-visible');
  setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 3500);
};

const STORAGE_KEY = 'unseen_map_history';
window.savedLocations = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

window.savedLocations = window.savedLocations.map((loc) => ({
  id: loc.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
  lat: loc.lat,
  lng: loc.lng,
  address: loc.address || '주소 정보 없음 (과거 기록)',
  date: loc.date || '날짜 정보 없음',
}));

window.currentUser = null;
window.db = null;
window.firebaseSet = null;
window.firebaseRef = null;

// ==== 클라우드 데이터 동기화 헬퍼 함수 ====
window.syncToFirebase = async function () {
  if (
    window.currentUser &&
    window.db &&
    window.firebaseSet &&
    window.firebaseRef
  ) {
    try {
      await window.firebaseSet(
        window.firebaseRef(
          window.db,
          `users/${window.currentUser.uid}/locations`,
        ),
        window.savedLocations,
      );
    } catch (error) {
      console.error('Firebase 동기화 실패:', error);
    }
  } else {
    // 비로그인 상태일 때는 기존처럼 기기 로컬 스토리지에 저장
    if (window.savedLocations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.savedLocations));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
};

// 초기 로딩 시 데이터 형식을 맞추고 1회 저장
if (!window.currentUser) window.syncToFirebase();

window.renderMarkers = function () {
  markerGroup.clearLayers();
  if (window.savedLocations.length === 0) return null;

  let bounds = L.latLngBounds();
  window.savedLocations.forEach((loc) => {
    // 말풍선(팝업)에 들어갈 HTML 내용 구성
    const popupContent = `
      <div style="text-align: center; min-width: 150px;">
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; word-break: keep-all; line-height: 1.4;">${loc.address}</div>
        <div style="font-size: 11px; color: #888;">📸 ${loc.date}</div>
      </div>
    `;
    L.marker([loc.lat, loc.lng], { icon: greenDotIcon })
      .bindPopup(popupContent, { closeButton: false, offset: [0, -10] }) // offset으로 팝업이 점을 가리지 않게 살짝 위로 띄움
      .on('click', () => {
        // 팝업이 열릴 때 해당 위치로 부드럽게 화면 이동 및 줌인 (최소 줌 레벨 16 보장)
        const targetZoom = Math.max(map.getZoom(), 16);
        map.flyTo([loc.lat, loc.lng], targetZoom, { duration: 1.0 });
      })
      .addTo(markerGroup);
    bounds.extend([loc.lat, loc.lng]);
  });
  return bounds;
};

const initialBounds = window.renderMarkers();
if (initialBounds) {
  map.fitBounds(initialBounds, { padding: [50, 50] });
}

window.getAddress = async function (lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    );
    const data = await response.json();
    return data.display_name || '알 수 없는 위치';
  } catch (error) {
    console.error('주소 변환 실패:', error);
    return '주소를 불러올 수 없습니다';
  }
};

// 과거 기록 백그라운드 주소 업데이트 (지도와 밀접한 코어 기능 유지)
async function updateLegacyRecords() {
  let hasUpdates = false;
  for (let loc of window.savedLocations) {
    if (loc.address === '주소 정보 없음 (과거 기록)') {
      loc.address = await window.getAddress(loc.lat, loc.lng);
      hasUpdates = true;
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  if (hasUpdates) {
    window.syncToFirebase();
    if (
      !document.getElementById('history-panel').classList.contains('hidden') &&
      window.renderHistory
    ) {
      window.renderHistory();
    }
  }
}
updateLegacyRecords();

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

// ==== Firebase 설정 및 UI 연동 ====
const firebaseConfig = {
  apiKey: 'AIzaSyBxPkir6dVhSLaWY2mZH4eOaI8YsT7qgdI',
  authDomain: 'findanunknownplace.firebaseapp.com',
  databaseURL: 'https://findanunknownplace-default-rtdb.firebaseio.com',
  projectId: 'findanunknownplace',
  storageBucket: 'findanunknownplace.firebasestorage.app',
  messagingSenderId: '850452352404',
  appId: '1:850452352404:web:0a2643876324ac77c35381',
  measurementId: 'G-VX303HR35M',
};

document.addEventListener('DOMContentLoaded', () => {
  // 동적으로 패널 최상단에 로그인 UI 삽입
  const uiPanel = document.getElementById('ui-panel');
  if (uiPanel) {
    const authContainer = document.createElement('div');
    authContainer.id = 'auth-container';
    authContainer.innerHTML = `
      <button id="login-btn" class="login-btn">
        <svg style="width:18px;height:18px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google 로그인하여 기록 동기화
      </button>
      <div id="user-profile" class="user-profile-box" style="display: none;">
        <span id="user-name"></span>
        <button id="logout-btn" class="logout-btn">로그아웃</button>
      </div>
    `;
    uiPanel.insertBefore(authContainer, uiPanel.firstChild);
  }
});

async function initFirebase() {
  try {
    // ES 모듈 동적 로드 (기존 HTML 구조 변경 없이 적용)
    const { initializeApp } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      onAuthStateChanged,
      signOut,
    } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getDatabase, ref, set, get } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    window.db = getDatabase(app);
    window.firebaseSet = set;
    window.firebaseRef = ref;
    const provider = new GoogleAuthProvider();

    onAuthStateChanged(auth, async (user) => {
      const loginBtn = document.getElementById('login-btn');
      const userProfile = document.getElementById('user-profile');
      const userName = document.getElementById('user-name');

      if (user) {
        window.currentUser = user;
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        if (userName) userName.innerText = user.displayName + '님';

        window.showToast('☁️ 클라우드 데이터를 확인하는 중...');
        const snapshot = await get(
          ref(window.db, `users/${user.uid}/locations`),
        );
        if (snapshot.exists()) {
          window.savedLocations = snapshot.val() || [];
          window.showToast('☁️ 클라우드 데이터 동기화 완료!');
        } else {
          // 클라우드가 비어있다면 현재 폰/컴퓨터의 기존 데이터를 클라우드로 백업
          const localData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
          if (localData.length > 0) {
            window.savedLocations = localData;
            await window.syncToFirebase();
            localStorage.removeItem(STORAGE_KEY);
            window.showToast('☁️ 기존 기기의 기록을 클라우드로 이동했습니다.');
          } else window.savedLocations = [];
        }
      } else {
        window.currentUser = null;
        if (loginBtn) loginBtn.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
        window.savedLocations =
          JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      }
      window.renderMarkers();
      if (window.renderHistory) window.renderHistory();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#login-btn')) {
        e.preventDefault();
        signInWithPopup(auth, provider).catch((err) =>
          console.error('로그인 에러:', err),
        );
      } else if (e.target.closest('#logout-btn')) {
        e.preventDefault();
        signOut(auth).catch((err) => console.error('로그아웃 에러:', err));
      }
    });
  } catch (error) {
    console.error('Firebase 로드 실패:', error);
  }
}
initFirebase();
