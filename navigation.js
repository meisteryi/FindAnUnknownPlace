// ==== 도시 및 권역 이동 네비게이션 기능 ====

// 모든 하위 메뉴를 닫는 헬퍼 함수
window.closeAllSubCities = function () {
  document.querySelectorAll('.sub-button-group').forEach((el) => {
    el.classList.remove('open');
  });
};

window.moveToCity = function (lat, lng, zoom) {
  window.closeAllSubCities(); // 다른 일반 도시 클릭 시 열려있는 하위 메뉴 모두 닫기
  map.flyTo([lat, lng], zoom, { duration: 1.5 });
};

// 하위 메뉴 내의 동네(예: 신주쿠, 강남) 클릭 시 (메뉴는 닫지 않고 지도만 이동)
window.moveToSubCity = function (lat, lng, zoom) {
  map.flyTo([lat, lng], zoom, { duration: 1.5 });
};

window.toggleSubCity = function (id, lat, lng, zoom) {
  map.flyTo([lat, lng], zoom, { duration: 1.5 });

  const subMenu = document.getElementById(id);
  const isCurrentlyOpen = subMenu && subMenu.classList.contains('open');

  // 다른 하위 메뉴들은 일단 닫기
  window.closeAllSubCities();

  // 클릭한 메뉴가 닫혀있었다면 열어주기 (토글 효과)
  if (subMenu && !isCurrentlyOpen) {
    subMenu.classList.add('open');
  }
};

// 클릭한 도시/동네 버튼 활성화 상태(색상) 변경 로직
document.addEventListener('click', function (e) {
  // city-section 영역 안의 city-btn을 클릭했을 때만 동작
  if (
    e.target.classList.contains('city-btn') &&
    e.target.closest('.city-section')
  ) {
    document
      .querySelectorAll('.city-section .city-btn')
      .forEach((btn) => btn.classList.remove('active-city'));
    e.target.classList.add('active-city');

    // 하위 동네 버튼(sub-btn)을 클릭했다면, 부모 도시 버튼도 같이 파란색으로 활성화
    if (e.target.classList.contains('sub-btn')) {
      const subGroup = e.target.closest('.sub-button-group');
      if (subGroup && subGroup.id) {
        const parentBtn = document.querySelector(
          `button[onclick*="'${subGroup.id}'"]`,
        );
        if (parentBtn) parentBtn.classList.add('active-city');
      }
    }
  }
});
