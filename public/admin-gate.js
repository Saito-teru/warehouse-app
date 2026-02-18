// public/admin-gate.js（完全版：編集前PINゲート）
//
// 注意：PINはフロント側に置くため、コードを見れば分かります。
// 目的は「誤操作防止」です。本格的な権限管理はサーバー側（JWT等）で行います。

(function () {
  const DEFAULT_PIN = "8458";
  const STORAGE_KEY_UNTIL = "admin_pin_until_ms";
  const STORAGE_KEY_OK = "admin_pin_ok";

  function nowMs() { return Date.now(); }

  function isUnlocked() {
    const ok = localStorage.getItem(STORAGE_KEY_OK) === "1";
    const until = Number(localStorage.getItem(STORAGE_KEY_UNTIL) || "0");
    return ok && Number.isFinite(until) && until > nowMs();
  }

  function lock() {
    localStorage.removeItem(STORAGE_KEY_OK);
    localStorage.removeItem(STORAGE_KEY_UNTIL);
  }

  function unlock(ttlMinutes) {
    const ttlMs = Math.max(1, Number(ttlMinutes || 60)) * 60 * 1000;
    localStorage.setItem(STORAGE_KEY_OK, "1");
    localStorage.setItem(STORAGE_KEY_UNTIL, String(nowMs() + ttlMs));
  }

  function createModal() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.zIndex = "9999";

    const box = document.createElement("div");
    box.style.width = "min(92vw, 420px)";
    box.style.background = "#fff";
    box.style.border = "1px solid #e5e7eb";
    box.style.borderRadius = "14px";
    box.style.padding = "14px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.15)";

    const title = document.createElement("div");
    title.textContent = "編集のためのパスワード";
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";
    title.style.marginBottom = "8px";

    const desc = document.createElement("div");
    desc.textContent = "編集を続けるにはパスワードを入力してください。";
    desc.style.fontSize = "12px";
    desc.style.color = "#4b5563";
    desc.style.lineHeight = "1.6";

    const input = document.createElement("input");
    input.type = "password";
    input.inputMode = "numeric";
    input.autocomplete = "current-password";
    input.placeholder = "パスワード（数字）";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.marginTop = "10px";
    input.style.padding = "10px 12px";
    input.style.border = "1px solid #d1d5db";
    input.style.borderRadius = "10px";
    input.style.fontSize = "16px";

    const err = document.createElement("div");
    err.style.marginTop = "8px";
    err.style.fontSize = "12px";
    err.style.color = "#991b1b";
    err.style.whiteSpace = "pre-wrap";
    err.style.display = "none";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginTop = "12px";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.textContent = "OK";
    okBtn.style.flex = "1";
    okBtn.style.padding = "10px 12px";
    okBtn.style.border = "1px solid #111827";
    okBtn.style.borderRadius = "10px";
    okBtn.style.background = "#fff";
    okBtn.style.cursor = "pointer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "キャンセル";
    cancelBtn.style.flex = "1";
    cancelBtn.style.padding = "10px 12px";
    cancelBtn.style.border = "1px solid #d1d5db";
    cancelBtn.style.borderRadius = "10px";
    cancelBtn.style.background = "#fff";
    cancelBtn.style.cursor = "pointer";

    row.appendChild(okBtn);
    row.appendChild(cancelBtn);

    const note = document.createElement("div");
    note.textContent = "この端末では一定時間、入力を省略できます。";
    note.style.marginTop = "10px";
    note.style.fontSize = "12px";
    note.style.color = "#6b7280";
    note.style.lineHeight = "1.6";

    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(input);
    box.appendChild(err);
    box.appendChild(row);
    box.appendChild(note);

    overlay.appendChild(box);

    return { overlay, input, err, okBtn, cancelBtn };
  }

  async function requireAdminPin(options) {
    const pin = String((options && options.pin) ? options.pin : DEFAULT_PIN);
    const ttlMinutes = (options && options.ttlMinutes) ? options.ttlMinutes : 60;

    if (isUnlocked()) return true;

    return await new Promise((resolve) => {
      const { overlay, input, err, okBtn, cancelBtn } = createModal();

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      function showError(message) {
        err.style.display = "block";
        err.textContent = message;
      }

      function tryOk() {
        const v = String(input.value || "").trim();
        if (!v) {
          showError("パスワードを入力してください。");
          return;
        }
        if (v !== pin) {
          showError("パスワードが違います。");
          input.value = "";
          input.focus();
          return;
        }
        unlock(ttlMinutes);
        close(true);
      }

      okBtn.addEventListener("click", tryOk);
      cancelBtn.addEventListener("click", () => close(false));

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close(false);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          tryOk();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          close(false);
        }
      });

      document.body.appendChild(overlay);
      setTimeout(() => input.focus(), 0);
    });
  }

  // 外から使うためにwindowへ
  window.requireAdminPin = requireAdminPin;
  window.adminPinLock = lock;
})();
