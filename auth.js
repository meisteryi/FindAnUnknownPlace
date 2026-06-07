// ==== Firebase 인증 및 데이터베이스 동기화 기능 ====

window.currentUser = null;
window.db = null;
window.firebaseSet = null;
window.firebaseRef = null;

// ==== 클라우드 데이터 동기화 헬퍼 함수 ====
window.syncToFirebase = async function () {
  const STORAGE_KEY = 'unseen_map_history';
  if (
    window.currentUser &&
    window.db &&
    window.firebaseSet &&
    window.firebaseRef
  ) {
    try {
      await window.firebaseSet(
        window.firebaseRef(
          window.db,
          `users/${window.currentUser.uid}/locations`,
        ),
        window.savedLocations,
      );
    } catch (error) {
      console.error('Firebase 동기화 실패:', error);
    }
  } else {
    // 비로그인 상태일 때는 기존처럼 기기 로컬 스토리지에 저장
    if (window.savedLocations && window.savedLocations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.savedLocations));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
};

// 초기 로딩 시 데이터 형식을 맞추고 1회 저장
if (!window.currentUser) window.syncToFirebase();

// ==== Firebase 설정 및 UI 연동 ====
const firebaseConfig = {
  apiKey: 'AIzaSyBxPkir6dVhSLaWY2mZH4eOaI8YsT7qgdI',
  authDomain: 'findanunknownplace.firebaseapp.com',
  databaseURL: 'https://findanunknownplace-default-rtdb.firebaseio.com',
  projectId: 'findanunknownplace',
  storageBucket: 'findanunknownplace.firebasestorage.app',
  messagingSenderId: '850452352404',
  appId: '1:850452352404:web:0a2643876324ac77c35381',
  measurementId: 'G-VX303HR35M',
};

document.addEventListener('DOMContentLoaded', () => {
  // 동적으로 패널 최상단에 로그인 UI 삽입
  const uiPanel = document.getElementById('ui-panel');
  if (uiPanel) {
    const authContainer = document.createElement('div');
    authContainer.id = 'auth-container';
    authContainer.innerHTML = `
      <div id="login-form">
        <input type="email" id="email-input" placeholder="이메일 (아이디)" class="auth-input" />
        <input type="password" id="password-input" placeholder="비밀번호 (6자리 이상)" class="auth-input" />
        <div class="auth-buttons">
          <button id="email-login-btn" class="login-btn">로그인</button>
          <button id="email-signup-btn" class="signup-btn">가입하기</button>
        </div>
      </div>
      <div id="user-profile" class="user-profile-box" style="display: none;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span id="user-name"></span>
          <button id="edit-nickname-btn" class="edit-btn" title="닉네임 변경">✏️</button>
        </div>
        <button id="logout-btn" class="logout-btn">로그아웃</button>
      </div>
    `;
    uiPanel.insertBefore(authContainer, uiPanel.firstChild);
  }
});

async function initFirebase() {
  try {
    // ES 모듈 동적 로드 (기존 HTML 구조 변경 없이 적용)
    const { initializeApp } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const {
      getAuth,
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      onAuthStateChanged,
      signOut,
      updateProfile,
    } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getDatabase, ref, set, get } =
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    window.db = getDatabase(app);
    window.firebaseSet = set;
    window.firebaseRef = ref;
    const STORAGE_KEY = 'unseen_map_history';

    onAuthStateChanged(auth, async (user) => {
      const loginForm = document.getElementById('login-form');
      const userProfile = document.getElementById('user-profile');
      const userName = document.getElementById('user-name');

      if (user) {
        window.currentUser = user;
        if (loginForm) loginForm.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        // 설정된 닉네임이 없으면 이메일 앞부분을 잘라서 임시로 사용
        const displayName =
          user.displayName ||
          (user.email ? user.email.split('@')[0] : '사용자');
        if (userName) userName.innerText = displayName + '님';

        window.showToast('☁️ 클라우드 데이터를 확인하는 중...');
        const snapshot = await get(
          ref(window.db, `users/${user.uid}/locations`),
        );
        if (snapshot.exists()) {
          window.savedLocations = snapshot.val() || [];
          window.showToast('☁️ 클라우드 데이터 동기화 완료!');
        } else {
          // 클라우드가 비어있다면 현재 폰/컴퓨터의 기존 데이터를 클라우드로 백업
          const localData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
          if (localData.length > 0) {
            window.savedLocations = localData;
            await window.syncToFirebase();
            localStorage.removeItem(STORAGE_KEY);
            window.showToast('☁️ 기존 기기의 기록을 클라우드로 이동했습니다.');
          } else window.savedLocations = [];
        }
      } else {
        window.currentUser = null;
        if (loginForm) loginForm.style.display = 'block';
        if (userProfile) userProfile.style.display = 'none';
        window.savedLocations =
          JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      }
      window.renderMarkers();
      if (window.renderHistory) window.renderHistory();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#email-login-btn')) {
        e.preventDefault();
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        if (!email || !password)
          return alert('이메일과 비밀번호를 입력해주세요.');

        signInWithEmailAndPassword(auth, email, password)
          .then(() => {
            document.getElementById('password-input').value = '';
          })
          .catch((err) => {
            console.error('로그인 에러:', err);
            alert(
              '로그인 실패: 등록되지 않은 아이디이거나 비밀번호가 틀렸습니다.',
            );
          });
      } else if (e.target.closest('#email-signup-btn')) {
        e.preventDefault();
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        if (!email || !password)
          return alert('가입하실 이메일과 비밀번호를 입력해주세요.');
        if (password.length < 6)
          return alert('비밀번호는 최소 6자리 이상이어야 합니다.');

        createUserWithEmailAndPassword(auth, email, password)
          .then(() => {
            document.getElementById('password-input').value = '';
            window.showToast('회원가입이 완료되었습니다!');
          })
          .catch((err) => {
            console.error('가입 에러:', err);
            alert(
              '가입 실패: 이미 존재하는 이메일이거나 형식이 잘못되었습니다.',
            );
          });
      } else if (e.target.closest('#logout-btn')) {
        e.preventDefault();
        signOut(auth).catch((err) => console.error('로그아웃 에러:', err));
      } else if (e.target.closest('#edit-nickname-btn')) {
        e.preventDefault();
        const currentName =
          window.currentUser.displayName ||
          (window.currentUser.email
            ? window.currentUser.email.split('@')[0]
            : '');
        const newName = prompt('새로운 닉네임을 입력하세요:', currentName);

        if (newName && newName.trim() !== '') {
          updateProfile(window.currentUser, { displayName: newName.trim() })
            .then(() => {
              document.getElementById('user-name').innerText =
                newName.trim() + '님';
              window.showToast('닉네임이 변경되었습니다!');
            })
            .catch((err) => {
              console.error('닉네임 변경 에러:', err);
              alert('닉네임 변경에 실패했습니다.');
            });
        }
      }
    });
  } catch (error) {
    console.error('Firebase 로드 실패:', error);
  }
}
initFirebase();
