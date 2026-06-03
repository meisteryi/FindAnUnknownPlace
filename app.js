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

// 마커를 효율적으로 관리(전체 삭제/그리기)하기 위한 레이어 그룹 추가
const markerGroup = L.layerGroup().addTo(map);

// 히스토리 클릭 시 표시될 임시 핀(마커) 변수
let activeHistoryMarker = null;

// 현 위치를 표시할 마커 변수
let currentLocationMarker = null;

// 토스트 메시지 띄우는 함수
function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('toast-visible');
  setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 3500); // 3.5초 후 스르륵 사라짐
}

// 현 위치로 이동 로직
document
  .getElementById('current-location-btn')
  .addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.');
      return;
    }

    showToast('📍 현재 위치를 찾는 중입니다...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        map.flyTo([lat, lng], 15, { duration: 1.5 });

        // 기존 마커가 있으면 위치 업데이트, 없으면 새로 생성
        if (currentLocationMarker) {
          currentLocationMarker.setLatLng([lat, lng]);
        } else {
          const blueDotIcon = L.divIcon({
            className: 'current-location-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          currentLocationMarker = L.marker([lat, lng], {
            icon: blueDotIcon,
          }).addTo(map);
        }
      },
      (error) => {
        console.error('위치 정보 에러:', error);
        alert(
          '위치 정보를 가져올 수 없습니다. 브라우저의 위치 권한을 허용해주세요.',
        );
      },
      { enableHighAccuracy: true }, // 더 정확한 GPS 정보 요구
    );
  });

// 3. 로컬 스토리지 키 및 기존 저장 데이터 불러오기
const STORAGE_KEY = 'unseen_map_history';
let savedLocations = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// 기존 데이터 호환성 유지 (이전에 저장된 점들에 ID와 주소, 날짜 강제 부여)
savedLocations = savedLocations.map((loc) => ({
  id: loc.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
  lat: loc.lat,
  lng: loc.lng,
  address: loc.address || '주소 정보 없음 (과거 기록)',
  date: loc.date || '날짜 정보 없음',
}));
localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));

// 지도에 점 전체 지우고 다시 그리기 함수
function renderMarkers() {
  markerGroup.clearLayers(); // 기존 점 싹 지우기
  if (savedLocations.length === 0) return null;

  let bounds = L.latLngBounds();
  savedLocations.forEach((loc) => {
    L.marker([loc.lat, loc.lng], { icon: greenDotIcon }).addTo(markerGroup);
    bounds.extend([loc.lat, loc.lng]);
  });
  return bounds;
}

// 페이지 로드 시 마커 그리기 및 시점 맞추기
const initialBounds = renderMarkers();
if (initialBounds) {
  map.fitBounds(initialBounds, { padding: [50, 50] });
}

// 좌표를 실제 주소로 변환하는 함수 (OpenStreetMap Nominatim API)
async function getAddress(lat, lng) {
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
}

document
  .getElementById('file-upload')
  .addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadLabel = document.getElementById('upload-label');
    const originalText = uploadLabel.innerHTML;
    uploadLabel.innerHTML = '⏳ 위치 및 주소 분석 중...';

    let validPoints = 0;
    const totalFiles = files.length;

    // 업로드한 '모든' 파일에 대해 순차적으로 처리
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      try {
        // 기존 exifr.gps() 대신 parse()를 사용하여 날짜를 포함한 전체 메타데이터 추출
        const exifData = await exifr.parse(file);
        if (exifData && exifData.latitude && exifData.longitude) {
          const { latitude, longitude } = exifData;

          // 사진의 EXIF 날짜 정보 추출 (우선순위: DateTimeOriginal -> CreateDate)
          let dateStr = '날짜 정보 없음';
          if (exifData.DateTimeOriginal) {
            dateStr = new Date(exifData.DateTimeOriginal).toLocaleString();
          } else if (exifData.CreateDate) {
            dateStr = new Date(exifData.CreateDate).toLocaleString();
          }

          // Nominatim API 무료 사용 정책(초당 1회 요청 제한) 준수
          if (validPoints > 0)
            await new Promise((resolve) => setTimeout(resolve, 1100));

          const address = await getAddress(latitude, longitude);

          // 새 기록 객체 생성
          savedLocations.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            lat: latitude,
            lng: longitude,
            address: address,
            date: dateStr, // 실제 사진의 촬영 날짜 저장
          });

          validPoints++;
        }
      } catch (error) {
        console.error('파일 처리 중 오류:', file.name, error);
      }
    }

    event.target.value = ''; // 다음 업로드를 위해 초기화
    uploadLabel.innerHTML = originalText;

    // 반투명 토스트 알림 띄우기
    showToast(`${totalFiles}장 중 ${validPoints}장 성공했습니다.`);

    // 위치 정보가 있는 사진이 하나라도 있으면 카메라 이동
    if (validPoints > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
      const newBounds = renderMarkers();

      if (validPoints === 1) {
        map.flyTo(newBounds.getCenter(), 15, { duration: 1.5 });
      } else {
        map.flyToBounds(newBounds, { padding: [50, 50], duration: 1.5 });
      }

      // 히스토리 창이 열려있다면 새로고침
      if (
        !document.getElementById('history-panel').classList.contains('hidden')
      ) {
        renderHistory();
      }
    } else {
      alert('위치 정보가 포함된 사진을 찾을 수 없습니다.');
    }
  });

// ==== 히스토리 UI 및 삭제 로직 ====
function renderHistory() {
  const listContainer = document.getElementById('history-list');
  listContainer.innerHTML = '';

  if (savedLocations.length === 0) {
    listContainer.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #888;">방문 기록이 없습니다.</div>';
    return;
  }

  // 최신순 정렬
  const reversed = [...savedLocations].reverse();

  reversed.forEach((loc) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.onclick = () => {
      map.flyTo([loc.lat, loc.lng], 15, { duration: 1.5 });

      // 기존에 꽂혀있던 임시 핀이 있다면 제거
      if (activeHistoryMarker) {
        map.removeLayer(activeHistoryMarker);
      }
      // 클릭한 위치에 새로운 임시 핀 꽂기 (Leaflet 기본 파란색 핀)
      activeHistoryMarker = L.marker([loc.lat, loc.lng]).addTo(map);
    };

    const addressDiv = document.createElement('div');
    addressDiv.className = 'history-address';
    addressDiv.innerText = loc.address; // 실제 주소 텍스트 출력

    const dateDiv = document.createElement('div');
    dateDiv.className = 'history-date';
    dateDiv.innerText = loc.date; // 업로드한 시간

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerText = '삭제';
    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // 삭제 버튼을 누를 때는 지도 이동 이벤트가 실행되지 않게 막습니다
      deleteRecord(loc.id);
    };

    item.appendChild(addressDiv);
    item.appendChild(dateDiv);
    item.appendChild(deleteBtn);
    listContainer.appendChild(item);
  });
}

function deleteRecord(id) {
  if (!confirm('이 방문 기록을 삭제하시겠습니까?')) return;

  // 배열에서 해당 ID 삭제 후 로컬스토리지 덮어쓰기
  savedLocations = savedLocations.filter((loc) => loc.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));

  // 지도 마커와 히스토리 패널 즉시 재렌더링
  renderMarkers();
  renderHistory();
}

// 히스토리 패널 끄고 켜기
document.getElementById('toggle-history').addEventListener('click', () => {
  const panel = document.getElementById('history-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderHistory();
  } else {
    // 패널이 닫힐 때 임시 핀도 함께 제거
    if (activeHistoryMarker) {
      map.removeLayer(activeHistoryMarker);
      activeHistoryMarker = null;
    }
  }
});

document.getElementById('close-history').addEventListener('click', () => {
  document.getElementById('history-panel').classList.add('hidden');
  // 패널이 닫힐 때 임시 핀도 함께 제거
  if (activeHistoryMarker) {
    map.removeLayer(activeHistoryMarker);
    activeHistoryMarker = null;
  }
});

// ==== 1. 전체 삭제 기능 ====
document.getElementById('clear-all-history').addEventListener('click', () => {
  if (savedLocations.length === 0) {
    alert('삭제할 기록이 없습니다.');
    return;
  }
  if (
    !confirm(
      '정말로 모든 방문 기록을 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)',
    )
  )
    return;

  savedLocations = [];
  localStorage.removeItem(STORAGE_KEY); // 로컬 스토리지 데이터 완전 초기화
  renderMarkers();
  renderHistory();
});

// ==== 2. 과거 기록(주소 없음) 백그라운드 업데이트 ====
async function updateLegacyRecords() {
  let hasUpdates = false;
  for (let loc of savedLocations) {
    if (loc.address === '주소 정보 없음 (과거 기록)') {
      loc.address = await getAddress(loc.lat, loc.lng);
      hasUpdates = true;
      await new Promise((resolve) => setTimeout(resolve, 1100)); // API 제한 준수
    }
  }
  if (hasUpdates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    if (!document.getElementById('history-panel').classList.contains('hidden'))
      renderHistory();
  }
}
updateLegacyRecords();

// ==== 개발용 초기화 로직 ====
const devResetBtn = document.getElementById('dev-reset-btn');
if (devResetBtn) {
  devResetBtn.addEventListener('click', () => {
    if (
      confirm(
        '개발용: 로컬 스토리지를 완전히 초기화하고 화면을 새로고침하시겠습니까?',
      )
    ) {
      localStorage.clear();
      location.reload();
    }
  });
}
