# 🌍 Unseen Map — 여행 사진 기반 미개척지 발자취 탐색 지도 서비스

<p align="center">
  <b>여행 중에 찍은 사진의 위치(EXIF)를 지도 위에 자동으로 기록하고, 아직 가보지 않은 숨은 골목길을 추천받으세요!</b>
</p>

---

## 💡 Overview

**Unseen Map (FindAnUnknownPlace)**은 여행자가 촬영한 사진들을 업로드하면 **사진 파일에 내장된 위치 메타데이터(EXIF)**를 자동으로 분석하여 지도 위에 시각화하고, 내가 아직 발을 들이지 않은 **주변 미개척지(골목길/새로운 장소)**를 발견할 수 있도록 도와주는 인터랙티브 지도 웹 애플리케이션입니다.

비로그인 상태에서는 브라우저 로컬 스토리지(`localStorage`)에 저장되며, 로그인 시 **Firebase Cloud Database**와 실시간으로 동기화되어 언제 어디서든 나만의 여행 발자취를 관리할 수 있습니다.

---

## ✨ Key Features (주요 기능)

### 1. 📸 EXIF 기반 사진 자동 매핑
* **다중 사진 업로드**: 여러 장의 사진(JPEG, PNG, HEIC 등)을 한 번에 드래그하거나 선택하여 업로드 가능
* **정밀 위치 메타데이터 추출**: `exifr` 라이브러리를 활용하여 사진 속 GPS 위도/경도, 촬영 일시를 자동으로 추출하고 지도 위에 마커 생성
* **중복 장소 자동 병합**: 동일한 위치에서 촬영된 여러 장의 사진을 그룹화하여 슬라이드 형식으로 모아보기 지원

### 2. 🗺️ 대화형 지도 시각화 (Interactive Map)
* **Leaflet.js & MarkerCluster**: 방대한 양의 사진 마커를 깔끔하게 그룹화(클러스터링)하여 성능 저하 없이 부드러운 줌/팬 탐색 제공
* **장소 검색(지오코딩)**: `leaflet-control-geocoder`를 연동하여 원하는 도시나 명소를 손쉽게 검색하고 즉시 이동
* **현재 내 위치 찾기**: 브라우저 Geolocation API를 통해 현재 사용자 위치로 원클릭 이동

### 3. 🧭 미개척지 골목 탐색 및 추천 (Recommend System)
* **방문 기록 분석 기반 추천 알고리즘**: 이미 다녀온 장소들을 기반으로 주변 반경 내 방문 빈도가 낮거나 기록이 없는 새로운 방향 및 추천 스팟을 계산하여 추천

### 4. 📜 여행 히스토리 & 갤러리 뷰
* **방문지 리스트 패널**: 업로드한 모든 여행지의 사진 썸네일과 방문 일시, 좌표 정보를 사이드 패널에서 일목요연하게 확인
* **마커 클릭 시 상세 팝업**: 촬영 사진 원본 뷰어 및 상세 설명 제공

### 5. ☁️ Firebase 계정 연동 및 클라우드 동기화
* **이메일 회원가입 및 로그인**: 간편한 계정 생성을 통해 기기가 바뀌어도 나의 여행 기록 보존
* **프로필 및 닉네임 설정**: 사용자 맞춤 닉네임 변경 지원
* **오프라인/비로그인 지원**: 로그인 없이도 로컬 스토리지에 데이터를 보존하며, 로그인 시 클라우드로 즉시 동기화

### 6. 📱 반응형 모바일 최적화 바텀시트
* 데스크톱 사이드바뿐 아니라 모바일 환경에서도 손가락 제스처(드래그 핸들)로 조작할 수 있는 직관적인 바텀시트 UI 탑재

---

## 🛠 Tech Stack (기술 스택)

| 영역 | 기술 스택 | 설명 |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 | 별도 빌드 도구 없이 브라우저 네이티브로 구동되는 가볍고 빠른 성능 |
| **Map Engine** | Leaflet.js | 전 세계적으로 널리 쓰이는 오픈소스 대화형 지도 라이브러리 |
| **Plugins** | Leaflet.markercluster, Leaflet-Control-Geocoder | 대규모 마커 클러스터링 및 장소 검색 기능 |
| **Metadata** | exifr (lite UMD) | 브라우저 내 초고속 클라이언트 단 EXIF 파싱 |
| **Backend & Auth** | Firebase Authentication & Realtime Database | 사용자 인증 및 실시간 여행 히스토리 클라우드 동기화 |

---

## 📂 Project Structure (프로젝트 구조)

```text
Unknownplace_map_service/
├── index.html          # 메인 UI 구조 및 외부 라이브러리 로드
├── app.js              # 지도 초기화, 메인 로직 및 마커 클러스터 관리
├── upload.js           # 이미지 파일 업로드 & EXIF 메타데이터 파싱
├── recommend.js        # 미개척지 골목 탐색 및 추천 알고리즘
├── history.js          # 여행 기록 목록 렌더링 및 마커 상호작용
├── auth.js             # Firebase 인증(이메일 로그인/회원가입) 및 DB 동기화
├── navigation.js       # 현재 위치 추적 및 지도 이동 제어
├── ui.js               # 패널 뷰 전환, 닉네임 모달 등 전반적인 UI 이벤트 처리
├── mobile-drag.js      # 모바일 반응형 바텀시트 터치/드래그 제스처 제어
├── styles.css          # 지도 기본 레이아웃 및 공통 스타일
├── ui.css              # 버튼, 폼, 메인 패널 스타일
├── history.css         # 히스토리 리스트 및 카드 스타일
└── mobile.css          # 모바일 뷰포트 미디어 쿼리 및 바텀시트 스타일
```

---

## 🚀 Getting Started (실행 방법)

별도의 npm 패키지 설치나 빌드 과정 없이 정적 웹 서버를 통해 즉시 실행할 수 있습니다.

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/meisteryi/FindAnUnknownPlace.git
   cd FindAnUnknownPlace
   ```

2. **로컬 웹 서버 실행**
   * VS Code의 **Live Server** 확장 프로그램을 사용하여 `index.html`을 실행하거나,
   * Python 내장 서버를 사용:
     ```bash
     python3 -m http.server 8000
     ```
3. 브라우저에서 `http://localhost:8000` 접속
