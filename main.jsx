import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // 화면을 꽉 채우는 전역 스타일(CSS) 적용

// main.html의 <div id="root">를 찾아서 React 돔을 렌더링합니다.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
