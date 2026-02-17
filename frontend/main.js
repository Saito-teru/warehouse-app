// frontend/main.js

// 環境に応じてサーバーURLを切り替え
// ローカルで確認する場合: localhost
// Render にデプロイ済みの場合: Render の URL
const SERVER_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://localhost:10000"
  : "https://warehouse-app-nwrw.onrender.com";

// ----------------------
// ログインフォーム送信
// ----------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${SERVER_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log(data);
    alert(JSON.stringify(data));
  } catch (err) {
    console.error(err);
    alert("通信エラー: サーバーが起動しているか確認してください");
  }
});

// ----------------------
// ここから他の API 処理も同様に追加可能
// 例: equipment 取得、プロジェクト登録、QRスキャンなど
// fetch(`${SERVER_URL}/equipment`)
//   .then(res => res.json())
//   .then(data => console.log(data));
// ----------------------
