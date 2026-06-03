// ==== 사진 업로드 (메타데이터 추출) ====
document
  .getElementById('file-upload')
  .addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadLabel = document.getElementById('upload-label');
    const uploadInput = document.getElementById('file-upload');
    const originalText = '📸 사진 업로드 (여러 장 가능)';

    const totalFiles = files.length;
    let validPoints = 0;
    const mobileOverlay = document.getElementById('mobile-progress-overlay');

    const updateProgress = (current) => {
      const percent = Math.round((current / totalFiles) * 100);
      uploadLabel.innerHTML = `⏳ 처리 중... (${current} / ${totalFiles})`;
      uploadLabel.appendChild(uploadInput); // input 요소 유지 (이벤트 리스너 버그 방지용)
      uploadLabel.style.background = `linear-gradient(to right, #28a745 ${percent}%, #007bff ${percent}%)`;
      uploadLabel.classList.add('processing');

      if (mobileOverlay && window.innerWidth <= 768) {
        mobileOverlay.classList.add('active');
        mobileOverlay.innerHTML = `⏳ 위치 분석 중<br><span style="font-size: 26px; font-weight: bold; margin-top: 10px; display: inline-block;">${current} / ${totalFiles}</span>`;
      }
    };

    updateProgress(0);

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
      updateProgress(i + 1);
    }

    uploadInput.value = '';
    uploadLabel.innerHTML = originalText;
    uploadLabel.appendChild(uploadInput);
    uploadLabel.style.background = ''; // 상태바 초기화
    uploadLabel.classList.remove('processing');
    if (mobileOverlay) mobileOverlay.classList.remove('active');

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
