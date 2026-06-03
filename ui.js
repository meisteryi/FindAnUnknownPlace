// ==== 현 위치 파악 및 이동 ====
document
  .getElementById('current-location-btn')
  .addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.');
      return;
    }
    window.showToast('📍 현재 위치를 찾는 중입니다...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.flyTo([lat, lng], 15, { duration: 1.5 });

        if (window.currentLocationMarker) {
          window.currentLocationMarker.setLatLng([lat, lng]);
        } else {
          const blueDotIcon = L.divIcon({
            className: 'current-location-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          window.currentLocationMarker = L.marker([lat, lng], {
            icon: blueDotIcon,
          }).addTo(map);
        }
      },
      (error) => {
        alert(
          '위치 정보를 가져올 수 없습니다. 브라우저의 위치 권한을 허용해주세요.',
        );
      },
      { enableHighAccuracy: true },
    );
  });

// ==== 개발용 초기화 버튼 ====
const devResetBtn = document.getElementById('dev-reset-btn');
if (devResetBtn) {
  devResetBtn.addEventListener('click', () => {
    if (confirm('로컬 스토리지를 완전히 초기화하시겠습니까?')) {
      localStorage.clear();
      location.reload();
    }
  });
}

// ==== PC 환경 패널 서랍 토글 ====
const uiPanel = document.getElementById('ui-panel');
const toggleBtn = document.getElementById('panel-toggle-btn');

if (toggleBtn && uiPanel) {
  toggleBtn.addEventListener('click', () => {
    uiPanel.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed'); // 버튼 자신도 같이 이동시킴

    if (uiPanel.classList.contains('collapsed')) {
      toggleBtn.innerText = '▶';
      toggleBtn.title = '패널 열기';
    } else {
      toggleBtn.innerText = '◀';
      toggleBtn.title = '패널 숨기기';
    }
  });
}
