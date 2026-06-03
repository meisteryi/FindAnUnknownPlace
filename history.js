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
