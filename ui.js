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

// ==== 모바일 바텀 시트 (드래그 제어 - 고스트 클릭 및 간섭 완벽 방어 버전) ====
const uiPanel = document.getElementById('ui-panel');

let startY = 0;
let currentY = 0;
let isDragging = false;
let isExpanded = false;
let lastTouchTime = 0; // 고스트 클릭(이중 터치) 방지용

function dragStart(e) {
  if (window.innerWidth > 768) return;

  // 터치와 마우스 이벤트가 연달아 터지는 '고스트 클릭' 방어
  if (e.type.includes('touch')) {
    lastTouchTime = Date.now();
  } else if (e.type.includes('mouse') && Date.now() - lastTouchTime < 500) {
    return;
  }

  const isHandle = e.target.closest('.drag-handle-wrapper');
  const isInteractive = e.target.closest('button, label, input');

  if (isInteractive) return; // 버튼 클릭은 정상 작동하도록 무시
  if (isExpanded && !isHandle) return; // 서랍이 열려있을 때는 내부 스크롤 허용

  if (e.type === 'mousedown') {
    e.preventDefault(); // 데스크톱 테스트 시 텍스트 선택 방지
  }

  isDragging = true;
  startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

  const maxTranslateY = uiPanel.offsetHeight - 120;
  currentY = isExpanded ? 0 : maxTranslateY;

  uiPanel.classList.add('dragging');
  uiPanel.style.transition = 'none'; // 마우스에 즉각적으로 반응하도록 애니메이션 딜레이 제거
}

function dragMove(e) {
  if (!isDragging) return;
  if (e.type.includes('mouse') && Date.now() - lastTouchTime < 500) return;

  if (e.cancelable) e.preventDefault(); // 모바일 스크롤 튕김 강력 방지

  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
  const deltaY = clientY - startY;
  let newY = currentY + deltaY;
  const maxTranslateY = uiPanel.offsetHeight - 120;

  if (newY < 0) newY = 0;
  if (newY > maxTranslateY) newY = maxTranslateY;

  uiPanel.style.transform = `translateY(${newY}px)`;
}

function dragEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  uiPanel.classList.remove('dragging');
  uiPanel.style.transition = '';
  uiPanel.style.transform = ''; // 인라인 스타일 제거, CSS 클래스에 위치를 맡김

  const endY = e.type.includes('mouse')
    ? e.clientY
    : e.changedTouches[0].clientY;
  const deltaY = endY - startY;

  // 이동 거리가 거의 없는 경우 (단순 클릭/터치)
  if (Math.abs(deltaY) < 5) {
    if (e.target.closest('.drag-handle-wrapper')) {
      isExpanded = !isExpanded;
    } else if (!isExpanded) {
      isExpanded = true; // 닫혀있을 때 빈 여백을 치기만 해도 열림
    }
  } else {
    // 실제로 드래그를 한 경우
    if (deltaY < -20) {
      isExpanded = true;
    } else if (deltaY > 20) {
      isExpanded = false;
    }
  }

  if (isExpanded) uiPanel.classList.add('expanded');
  else uiPanel.classList.remove('expanded');
}

if (uiPanel) {
  uiPanel.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', dragMove, { passive: false });
  document.addEventListener('mouseup', dragEnd);

  uiPanel.addEventListener('touchstart', dragStart, { passive: false });
  document.addEventListener('touchmove', dragMove, { passive: false });
  document.addEventListener('touchend', dragEnd);

  // 지도 빈 공간 터치/클릭 시 열려있는 서랍 스르륵 닫기
  map.on('click', () => {
    if (isExpanded) {
      isExpanded = false;
      uiPanel.classList.remove('expanded');
    }
  });
}

// ==== PC 환경 패널 최소화 및 복원 ====
const minimizeBtn = document.getElementById('minimize-panel-btn');
const restoreBtn = document.getElementById('restore-panel-btn');

if (minimizeBtn && restoreBtn) {
  minimizeBtn.addEventListener('click', () => {
    uiPanel.classList.add('collapsed');
    restoreBtn.classList.remove('hidden-btn');
  });
  restoreBtn.addEventListener('click', () => {
    uiPanel.classList.remove('collapsed');
    restoreBtn.classList.add('hidden-btn');
  });
}
