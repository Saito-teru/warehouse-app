// public/js/auth.js
// 全ページで読み込む認証チェック共通ファイル

(function () {
  const PUBLIC_PAGES = ['/login.html'];

  function isPublicPage() {
    return PUBLIC_PAGES.some(p => location.pathname.endsWith(p));
  }

  function getToken() {
    return localStorage.getItem('token') || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/login.html';
  }

  // ログインページ以外でトークンがなければログインへ
  if (!isPublicPage() && !getToken()) {
    location.href = '/login.html';
  }

  // グローバルに公開
  window.authUtils = { getToken, getUser, logout };
})();