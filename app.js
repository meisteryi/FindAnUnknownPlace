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

// auth.js에서 덮어씌워질 동기화 함수 (스크립트 로딩 지연 중 호출 오류 방지용)
window.syncToFirebase = window.syncToFirebase || async function () {};

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
