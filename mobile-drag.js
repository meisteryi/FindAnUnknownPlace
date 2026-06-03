// ==== 모바일 바텀 시트 (드래그 제어 - 고스트 클릭 및 간섭 완벽 방어 버전) ====
const dragPanel = document.getElementById('ui-panel');

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

  const maxTranslateY = dragPanel.offsetHeight - 120;
  currentY = isExpanded ? 0 : maxTranslateY;

  dragPanel.classList.add('dragging');
  dragPanel.style.transition = 'none'; // 마우스에 즉각적으로 반응하도록 애니메이션 딜레이 제거
}

function dragMove(e) {
  if (!isDragging) return;
  if (e.type.includes('mouse') && Date.now() - lastTouchTime < 500) return;

  if (e.cancelable) e.preventDefault(); // 모바일 스크롤 튕김 강력 방지

  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
  const deltaY = clientY - startY;
  let newY = currentY + deltaY;
  const maxTranslateY = dragPanel.offsetHeight - 120;

  if (newY < 0) newY = 0;
  if (newY > maxTranslateY) newY = maxTranslateY;

  dragPanel.style.transform = `translateY(${newY}px)`;
}

function dragEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  dragPanel.classList.remove('dragging');
  dragPanel.style.transition = '';
  dragPanel.style.transform = ''; // 인라인 스타일 제거, CSS 클래스에 위치를 맡김

  const endY = e.type.includes('mouse')
    ? e.clientY
    : e.changedTouches[0].clientY;
  const deltaY = endY - startY;

  if (Math.abs(deltaY) < 5) {
    if (e.target.closest('.drag-handle-wrapper')) isExpanded = !isExpanded;
    else if (!isExpanded) isExpanded = true;
  } else {
    if (deltaY < -20) isExpanded = true;
    else if (deltaY > 20) isExpanded = false;
  }

  if (isExpanded) dragPanel.classList.add('expanded');
  else dragPanel.classList.remove('expanded');
}

if (dragPanel) {
  dragPanel.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', dragMove, { passive: false });
  document.addEventListener('mouseup', dragEnd);

  dragPanel.addEventListener('touchstart', dragStart, { passive: false });
  document.addEventListener('touchmove', dragMove, { passive: false });
  document.addEventListener('touchend', dragEnd);

  // 지도 빈 공간 터치/클릭 시 열려있는 서랍 스르륵 닫기
  map.on('click', () => {
    if (isExpanded) {
      isExpanded = false;
      dragPanel.classList.remove('expanded');
    }
  });
}
