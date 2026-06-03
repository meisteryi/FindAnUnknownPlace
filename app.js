// 한국-일본 지역 바운더리 (남서쪽 [위도, 경도], 북동쪽 [위도, 경도])
const bounds = [
  [24.0, 122.0], // 오키나와/대만 근처 (남서쪽 끝)
  [46.0, 146.0], // 홋카이도 북동쪽 끝
];

// 1. Leaflet 지도 초기화 및 영역 제한
const map = L.map('map', {
  maxBounds: bounds, // 지도 이동 가능 영역 제한
  maxBoundsViscosity: 1.0, // 바운더리 밖으로 튕겨 나가지 않도록 고무줄 효과 최대치
  minZoom: 5, // 너무 멀리 우주로 축소되지 않도록 제한
}).setView([37.5665, 126.978], 11);

// 2. 속도 최적화: 가장 빠른 CartoDB 글로벌 타일 서버 적용
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    crossOrigin: true, // 리소스 로딩 최적화
  },
).addTo(map);

// 특정 대도시로 부드럽게 이동하는 함수
window.moveToCity = function (lat, lng, zoom) {
  map.flyTo([lat, lng], zoom, { duration: 1.5 });
};

// 커스텀 초록색 흐린 점 마커 아이콘 설정
const greenDotIcon = L.divIcon({
  className: 'green-dot-marker',
  iconSize: [40, 40], // CSS에서 정의한 크기와 맞춤
  iconAnchor: [20, 20], // 중심을 좌표에 맞추기
});

document
  .getElementById('file-upload')
  .addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let validPoints = 0;
    let markersBounds = L.latLngBounds(); // 여러 마커를 모두 포함할 수 있는 영역 객체

    // 업로드한 '모든' 파일에 대해 순차적으로 처리
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      try {
        const gpsData = await exifr.gps(file);
        if (gpsData && gpsData.latitude && gpsData.longitude) {
          const { latitude, longitude } = gpsData;

          // 커스텀 초록색 흐린 점 생성
          L.marker([latitude, longitude], { icon: greenDotIcon }).addTo(map);

          markersBounds.extend([latitude, longitude]);
          validPoints++;
        }
      } catch (error) {
        console.error('파일 처리 중 오류:', file.name, error);
      }
    }

    event.target.value = ''; // 다음 업로드를 위해 초기화

    // 위치 정보가 있는 사진이 하나라도 있으면 카메라 이동
    if (validPoints > 0) {
      if (validPoints === 1) {
        // 사진이 1장이면 해당 위치로 확대
        map.flyTo(markersBounds.getCenter(), 15, { duration: 1.5 });
      } else {
        // 사진이 여러 장이면 모든 점이 한눈에 보이게 줌 아웃/인 (여백 50px 추가)
        map.flyToBounds(markersBounds, { padding: [50, 50], duration: 1.5 });
      }
    } else {
      alert('위치 정보가 포함된 사진을 찾을 수 없습니다.');
    }
  });
