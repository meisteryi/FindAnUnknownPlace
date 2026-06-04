window.renderHistory = function () {
  const listContainer = document.getElementById('history-list');
  listContainer.innerHTML = '';

  if (window.savedLocations.length === 0) {
    listContainer.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #888;">방문 기록이 없습니다.</div>';
    return;
  }

  const reversed = [...window.savedLocations].reverse();

  reversed.forEach((loc) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.onclick = () => {
      map.flyTo([loc.lat, loc.lng], 15, { duration: 1.5 });
      if (window.activeHistoryMarker)
        map.removeLayer(window.activeHistoryMarker);
      window.activeHistoryMarker = L.marker([loc.lat, loc.lng]).addTo(map);
    };

    const addressDiv = document.createElement('div');
    addressDiv.className = 'history-address';
    addressDiv.innerText = loc.address;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'history-date';
    dateDiv.innerText = loc.date;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerText = '삭제';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      window.deleteRecord(loc.id);
    };

    item.appendChild(addressDiv);
    item.appendChild(dateDiv);
    item.appendChild(deleteBtn);
    listContainer.appendChild(item);
  });
};

window.deleteRecord = function (id) {
  if (!confirm('이 방문 기록을 삭제하시겠습니까?')) return;
  window.savedLocations = window.savedLocations.filter((loc) => loc.id !== id);
  localStorage.setItem(
    'unseen_map_history',
    JSON.stringify(window.savedLocations),
  );
  window.renderMarkers();
  window.renderHistory();
};

document.getElementById('toggle-history').addEventListener('click', () => {
  const panel = document.getElementById('history-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    window.renderHistory();
  } else {
    if (window.activeHistoryMarker) {
      map.removeLayer(window.activeHistoryMarker);
      window.activeHistoryMarker = null;
    }
  }
});

document.getElementById('close-history').addEventListener('click', () => {
  document.getElementById('history-panel').classList.add('hidden');
  if (window.activeHistoryMarker) {
    map.removeLayer(window.activeHistoryMarker);
    window.activeHistoryMarker = null;
  }
});

document.getElementById('clear-all-history').addEventListener('click', () => {
  if (window.savedLocations.length === 0) {
    alert('삭제할 기록이 없습니다.');
    return;
  }
  if (
    !confirm(
      '정말로 모든 방문 기록을 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)',
    )
  )
    return;

  window.savedLocations = [];
  localStorage.removeItem('unseen_map_history');
  window.renderMarkers();
  window.renderHistory();
});

// ==== 데이터 백업 (내보내기) ====
document.getElementById('backup-history').addEventListener('click', () => {
  if (window.savedLocations.length === 0) {
    alert('백업할 기록이 없습니다.');
    return;
  }
  const dataStr = JSON.stringify(window.savedLocations, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unseen_map_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ==== 데이터 복원 (불러오기) ====
document
  .getElementById('restore-history')
  .addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData))
          throw new Error('올바른 파일 형식이 아닙니다.');

        let finalData = [];
        if (window.savedLocations.length > 0) {
          if (
            confirm(
              `불러온 ${importedData.length}개의 기록을 기존 데이터에 합치시겠습니까?\n(취소를 누르면 기존 데이터가 모두 지워지고 덮어씌워집니다.)`,
            )
          ) {
            // 기존 데이터와 병합하고 중복 제거(ID 기준)
            const uniqueIds = new Set();
            finalData = [...window.savedLocations, ...importedData].filter(
              (loc) => (uniqueIds.has(loc.id) ? false : uniqueIds.add(loc.id)),
            );
          } else if (
            confirm('경고: 정말로 기존 데이터를 모두 지우고 덮어쓰시겠습니까?')
          ) {
            finalData = importedData;
          } else return; // 완전 취소
        } else finalData = importedData;

        window.savedLocations = finalData;
        localStorage.setItem(
          'unseen_map_history',
          JSON.stringify(window.savedLocations),
        );
        window.renderMarkers();
        window.renderHistory();
        alert('데이터 복원이 완료되었습니다!');
      } catch (err) {
        alert('데이터를 복원하는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // 재업로드를 위해 초기화
  });
