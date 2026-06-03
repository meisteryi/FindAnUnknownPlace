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

// ==== 사진 업로드 (메타데이터 추출) ====
document
  .getElementById('file-upload')
  .addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadLabel = document.getElementById('upload-label');
    const originalText = uploadLabel.innerHTML;
    uploadLabel.innerHTML = '⏳ 위치 및 주소 분석 중...';

    let validPoints = 0;
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      try {
        const exifData = await exifr.parse(file);
        if (exifData && exifData.latitude && exifData.longitude) {
          const { latitude, longitude } = exifData;

          let dateStr = '날짜 정보 없음';
          if (exifData.DateTimeOriginal)
            dateStr = new Date(exifData.DateTimeOriginal).toLocaleString();
          else if (exifData.CreateDate)
            dateStr = new Date(exifData.CreateDate).toLocaleString();

          if (validPoints > 0)
            await new Promise((resolve) => setTimeout(resolve, 1100));
          const address = await window.getAddress(latitude, longitude);

          window.savedLocations.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            lat: latitude,
            lng: longitude,
            address: address,
            date: dateStr,
          });
          validPoints++;
        }
      } catch (error) {
        console.error('파일 처리 중 오류:', file.name, error);
      }
    }

    event.target.value = '';
    uploadLabel.innerHTML = originalText;
    window.showToast(`${files.length}장 중 ${validPoints}장 성공했습니다.`);

    if (validPoints > 0) {
      localStorage.setItem(
        'unseen_map_history',
        JSON.stringify(window.savedLocations),
      );
      const newBounds = window.renderMarkers();

      if (validPoints === 1)
        map.flyTo(newBounds.getCenter(), 15, { duration: 1.5 });
      else map.flyToBounds(newBounds, { padding: [50, 50], duration: 1.5 });

      if (
        !document.getElementById('history-panel').classList.contains('hidden')
      )
        window.renderHistory();
    } else {
      alert('위치 정보가 포함된 사진을 찾을 수 없습니다.');
    }
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

// ==== 모바일 바텀 시트 (드래그 핸들 & 클릭 토글) ====
const uiPanel = document.getElementById('ui-panel');
const dragHandle = document.getElementById('drag-handle');

let startY = 0;
let initialTranslateY = 0;
let isDragging = false;
let isExpanded = false;
let dragStartTime = 0;

function isMobile() {
  return window.innerWidth <= 768;
}

function getClientY(e) {
  return e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
}

function onDragStart(e) {
  if (!isMobile()) return;
  isDragging = true;
  dragStartTime = Date.now();
  startY = getClientY(e);

  const maxTranslateY = uiPanel.offsetHeight - 120;
  initialTranslateY = isExpanded ? 0 : maxTranslateY;
  uiPanel.classList.add('dragging');
}

function onDragMove(e) {
  if (!isDragging) return;
  if (e.cancelable) e.preventDefault(); // 드래그 중 화면 튕김(스크롤) 차단

  const deltaY = getClientY(e) - startY;
  let newTranslateY = initialTranslateY + deltaY;
  const maxTranslateY = uiPanel.offsetHeight - 120;

  if (newTranslateY < 0) newTranslateY = 0;
  if (newTranslateY > maxTranslateY) newTranslateY = maxTranslateY;
  uiPanel.style.transform = `translateY(${newTranslateY}px)`;
}

function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  uiPanel.classList.remove('dragging');
  uiPanel.style.transform = '';

  const dragDuration = Date.now() - dragStartTime;
  const deltaY = getClientY(e) - startY;
  const maxTranslateY = uiPanel.offsetHeight - 120;

  // 클릭(짧은 터치)으로 인식된 경우 상태 반전(토글)
  if (dragDuration < 200 && Math.abs(deltaY) < 10) {
    isExpanded = !isExpanded;
  } else {
    const finalTranslateY = initialTranslateY + deltaY;
    isExpanded = finalTranslateY < maxTranslateY / 2;
  }

  if (isExpanded) uiPanel.classList.add('expanded');
  else uiPanel.classList.remove('expanded');
}

if (dragHandle) {
  dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd, { passive: false });
  dragHandle.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}
