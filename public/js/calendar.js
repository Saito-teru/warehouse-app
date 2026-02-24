// public/js/calendar.js（完全置換）
// JST固定表示（PCローカル非依存）・日跨ぎ分割・重なり横並び・status色・color_key・不足赤枠
// 例外は必ず #errorText に表示して、描画停止の原因を見える化する

(() => {
  "use strict";

  const JST_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  // ===== 基本 =====
  const pad2 = (n) => String(n).padStart(2, "0");
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function qs(name) {
    return new URL(location.href).searchParams.get(name);
  }
  function setQs(name, value) {
    const u = new URL(location.href);
    u.searchParams.set(name, value);
    history.replaceState(null, "", u.toString());
  }

  function showError(msg) {
    const el = document.getElementById("errorText");
    if (el) el.textContent = msg || "";
  }
  function clearError() {
    showError("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCellHeightPx() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--cell-h").trim();
    const n = Number(String(v).replace("px", ""));
    return Number.isFinite(n) && n > 0 ? n : 28;
  }

  function setActiveMode(mode) {
    for (const id of ["modeDay", "modeWeek", "mode2Week", "modeMonth"]) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.classList.toggle("is-active", btn.getAttribute("data-mode") === mode);
    }
  }

  // ===== 認証/通信 =====
  function getToken() {
    const keys = ["token", "jwt", "authToken", "access_token"];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim().replace(/^Bearer\s+/i, "");
    }
    return null;
  }

  async function apiJson(url) {
    const token = getToken();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ===== JST(日付境界) を UTCms で扱うための関数群 =====
  // JSTの 00:00 を UTCms で表す
  function jstMidnightUtcMs(y, m, d) {
    // JST 00:00 = UTC 前日 15:00
    return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JST_MS;
  }

  // UTCms → JST年月日（UTC getter で読むために +9h してから UTC getter）
  function ymdFromUtcMsAsJst(ms) {
    const j = new Date(ms + JST_MS);
    return {
      y: j.getUTCFullYear(),
      m: j.getUTCMonth() + 1,
      d: j.getUTCDate(),
      wd: j.getUTCDay(), // 0=日
    };
  }

  function dayKeyFromDayStartMs(dayStartMs) {
    const p = ymdFromUtcMsAsJst(dayStartMs);
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
  }

  function weekdayJaFromDayStartMs(dayStartMs) {
    const p = ymdFromUtcMsAsJst(dayStartMs);
    return ["日", "月", "火", "水", "木", "金", "土"][p.wd];
  }

  // 任意のUTC Date → その日のJST 00:00 を UTCms で返す
  function startOfJstDayFromUtcDate(dUtc) {
    const ms = dUtc.getTime();
    const p = ymdFromUtcMsAsJst(ms);
    return jstMidnightUtcMs(p.y, p.m, p.d);
  }

  function startOfJstWeekFromAnchorMs(anchorMs) {
    const day0 = startOfJstDayFromUtcDate(new Date(anchorMs));
    const wd = ymdFromUtcMsAsJst(day0).wd; // 0=日
    return day0 - wd * DAY_MS;
  }

  function startOfJstMonthFromAnchorMs(anchorMs) {
    const p = ymdFromUtcMsAsJst(anchorMs);
    return jstMidnightUtcMs(p.y, p.m, 1);
  }

  function computeRange(anchorMs, mode) {
    if (mode === "day") return { startMs: startOfJstDayFromUtcDate(new Date(anchorMs)), days: 1 };
    if (mode === "week") return { startMs: startOfJstWeekFromAnchorMs(anchorMs), days: 7 };
    if (mode === "2week") return { startMs: startOfJstWeekFromAnchorMs(anchorMs), days: 14 };

    const s = startOfJstMonthFromAnchorMs(anchorMs);
    const p = ymdFromUtcMsAsJst(s);
    const next = (p.m === 12) ? { y: p.y + 1, m: 1, d: 1 } : { y: p.y, m: p.m + 1, d: 1 };
    const nextMs = jstMidnightUtcMs(next.y, next.m, next.d);
    const days = Math.round((nextMs - s) / DAY_MS);
    return { startMs: s, days };
  }

  function isoDateForPickerFromAnchorMs(anchorMs) {
    const p = ymdFromUtcMsAsJst(anchorMs);
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
  }

  function syncDateParamToUrl(anchorMs) {
    const p = ymdFromUtcMsAsJst(anchorMs);
    setQs("date", `${p.y}-${pad2(p.m)}-${pad2(p.d)}`);
  }

  function anchorFromUrlOrNow() {
    const dateQs = qs("date");
    if (dateQs && /^\d{4}-\d{2}-\d{2}$/.test(dateQs)) {
      const [y, m, d] = dateQs.split("-").map(Number);
      if ([y, m, d].every(Number.isFinite)) return jstMidnightUtcMs(y, m, d);
    }
    // 今の時刻 → JST日付へ丸め
    return startOfJstDayFromUtcDate(new Date());
  }

  // ===== UI構築 =====
  function buildTimeColumn() {
    const timeCol = document.getElementById("timeCol");
    if (!timeCol) return;
    timeCol.innerHTML = "";
    const cellH = getCellHeightPx();
    for (let i = 0; i < 48; i++) {
      const h = Math.floor(i / 2);
      const mm = (i % 2 === 0) ? "00" : "30";
      const div = document.createElement("div");
      div.className = "cal-time-slot";
      div.style.height = `${cellH}px`;
      div.textContent = `${pad2(h)}:${mm}`;
      timeCol.appendChild(div);
    }
  }

  function buildGridShell(startMs, days) {
    const daysHeader = document.getElementById("daysHeader");
    const daysGrid = document.getElementById("daysGrid");
    if (!daysHeader || !daysGrid) return;

    daysHeader.innerHTML = "";
    daysGrid.innerHTML = "";
    const cellH = getCellHeightPx();

    for (let i = 0; i < days; i++) {
      const dayStartMs = startMs + i * DAY_MS;
      const p = ymdFromUtcMsAsJst(dayStartMs);
      const w = weekdayJaFromDayStartMs(dayStartMs);
      const dayKey = `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;

      const head = document.createElement("div");
      head.className = "cal-day-head";
      if (w === "土") head.classList.add("is-sat");
      if (w === "日") head.classList.add("is-sun");
      head.textContent = `${p.m}/${p.d}（${w}）`;
      daysHeader.appendChild(head);

      const col = document.createElement("div");
      col.className = "cal-day-col";
      if (w === "土") col.classList.add("is-sat");
      if (w === "日") col.classList.add("is-sun");
      col.dataset.date = dayKey;

      for (let j = 0; j < 48; j++) {
        const line = document.createElement("div");
        line.className = "cal-slot-line";
        line.style.height = `${cellH}px`;
        if (j % 2 === 0) line.classList.add("hour");
        col.appendChild(line);
      }
      daysGrid.appendChild(col);
    }
  }

  // ===== 重なり横並び =====
  function layoutOverlaps(entries) {
    const sorted = entries.slice().sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

    const clusters = [];
    let cur = [];
    let curEnd = -1;

    for (const e of sorted) {
      if (cur.length === 0) { cur = [e]; curEnd = e.endMin; continue; }
      if (e.startMin < curEnd) { cur.push(e); curEnd = Math.max(curEnd, e.endMin); }
      else { clusters.push(cur); cur = [e]; curEnd = e.endMin; }
    }
    if (cur.length) clusters.push(cur);

    const laid = [];
    for (const cluster of clusters) {
      const used = new Set();
      const active = [];
      let maxCols = 0;

      const items = cluster.slice().sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      for (const it of items) {
        for (let i = active.length - 1; i >= 0; i--) {
          if (active[i].endMin <= it.startMin) {
            used.delete(active[i].colIndex);
            active.splice(i, 1);
          }
        }
        let col = 0; while (used.has(col)) col++;
        used.add(col);
        it.colIndex = col;
        active.push({ endMin: it.endMin, colIndex: col });
        maxCols = Math.max(maxCols, used.size);
      }
      for (const it of items) { it.colCount = maxCols; laid.push(it); }
    }
    return laid;
  }

  // ===== 不足判定 =====
  async function buildShortageIdSet(projects) {
    const set = new Set();
    for (const p of projects) {
      try {
        const r = await apiJson(`/api/shortages?project_id=${encodeURIComponent(String(p.id))}`);
        const list = Array.isArray(r) ? r : (r && r.shortages ? r.shortages : []);
        const has = Array.isArray(list) && list.some(x => Number(x.shortage) > 0);
        if (has) set.add(String(p.id));
      } catch {}
    }
    return set;
  }

  // ===== 描画 =====
  function clearRenderedBlocks() {
    document.querySelectorAll(".cal-project").forEach(el => el.remove());
  }

  function renderProjects(projects, rangeStartMs, days, shortageIdSet) {
    clearRenderedBlocks();

    const cols = Array.from(document.querySelectorAll(".cal-day-col"));
    const rangeEndMs = rangeStartMs + days * DAY_MS;

    // 日ごとに分割して入れる
    const byDay = new Map();

    for (const p of (projects || [])) {
      const sIso = p.usage_start_at ?? p.usage_start;
      const eIso = p.usage_end_at ?? p.usage_end;

      const sUtc = new Date(sIso);
      const eUtc = new Date(eIso);
      if (isNaN(sUtc.getTime()) || isNaN(eUtc.getTime())) continue;

      const sMs = sUtc.getTime();
      const eMs = eUtc.getTime();
      if (eMs <= sMs) continue;

      // 表示範囲外
      if (eMs <= rangeStartMs || sMs >= rangeEndMs) continue;

      // 分割ループ（日跨ぎ対応）
      let curDayStartMs = startOfJstDayFromUtcDate(sUtc);
      const endDayStartMs = startOfJstDayFromUtcDate(new Date(eMs - 1));

      while (curDayStartMs <= endDayStartMs) {
        const dayStartMs = curDayStartMs;
        const dayEndMs = dayStartMs + DAY_MS;

        const clipStart = Math.max(sMs, dayStartMs);
        const clipEnd = Math.min(eMs, dayEndMs);

        if (clipEnd > clipStart) {
          const startMin = clamp((clipStart - dayStartMs) / 60000, 0, 1440);
          const endMin = clamp((clipEnd - dayStartMs) / 60000, 0, 1440);

          const dayKey = dayKeyFromDayStartMs(dayStartMs);
          if (!byDay.has(dayKey)) byDay.set(dayKey, []);
          byDay.get(dayKey).push({ p, startMin, endMin, colIndex: 0, colCount: 1 });
        }

        curDayStartMs += DAY_MS;
      }
    }

    const cellH = getCellHeightPx();
    const minutesPerCell = 30;

    for (const [dayKey, entries] of byDay.entries()) {
      const colEl = cols.find(c => c.dataset.date === dayKey);
      if (!colEl) continue;

      const laid = layoutOverlaps(entries);

      const PAD_L = 6, PAD_R = 6, GAP = 6;
      const colW = colEl.getBoundingClientRect().width;
      const innerW = Math.max(0, colW - PAD_L - PAD_R);

      for (const e of laid) {
        const p = e.p;

        const top = e.startMin * (cellH / minutesPerCell);
        const height = Math.max(10, (e.endMin - e.startMin) * (cellH / minutesPerCell));

        const colsCount = Math.max(1, e.colCount);
        const idx = Math.max(0, e.colIndex);

        const wRaw = (colsCount === 1) ? innerW : (innerW - GAP * (colsCount - 1)) / colsCount;
        const w = Math.max(40, wRaw);
        const left = PAD_L + idx * (w + GAP);
        const width = Math.max(40, Math.min(w, PAD_L + innerW - left));

        const block = document.createElement("div");
        block.className = "cal-project";
        block.dataset.projectId = String(p.id);

        // status色（CSSの .cal-project.draft など）
        block.classList.add(p.status || "draft");

        // color_key（CSSの .cal-color--N）
        if (p.color_key != null && p.color_key !== "") {
          const ck = Number(p.color_key);
          if (Number.isFinite(ck) && ck >= 1 && ck <= 12) block.classList.add(`cal-color--${ck}`);
        }

        // 不足赤枠
        if (shortageIdSet && shortageIdSet.has(String(p.id))) {
          block.classList.add("cal-project--shortage");
        }

        block.style.top = `${top.toFixed(2)}px`;
        block.style.height = `${height.toFixed(2)}px`;
        block.style.left = `${left.toFixed(2)}px`;
        block.style.width = `${width.toFixed(2)}px`;
        block.style.right = "auto";

        const title = p.title ?? "(無題)";
        const venue = (p.venue ?? "").toString().trim();

        // CSSが title/venue の子要素を想定していても崩れないように class を付ける
        block.innerHTML = `
          <div class="cal-project-title">${escapeHtml(title)}</div>
          ${venue ? `<div class="cal-project-venue">${escapeHtml(venue)}</div>` : ""}
        `;

        block.addEventListener("click", () => {
          const ret = encodeURIComponent(location.pathname + location.search);
          location.href = `/project-edit.html?project_id=${encodeURIComponent(String(p.id))}&return=${ret}`;
        });

        colEl.appendChild(block);
      }
    }
  }

  // ===== 状態 =====
  let mode = qs("mode") || "week";
  let anchorMs = anchorFromUrlOrNow();

  function shiftAnchor(dir) {
    if (mode === "day") anchorMs += dir * DAY_MS;
    else if (mode === "week") anchorMs += dir * 7 * DAY_MS;
    else if (mode === "2week") anchorMs += dir * 14 * DAY_MS;
    else {
      const p = ymdFromUtcMsAsJst(anchorMs);
      let y = p.y;
      let m = p.m + dir;
      while (m <= 0) { y--; m += 12; }
      while (m >= 13) { y++; m -= 12; }
      anchorMs = jstMidnightUtcMs(y, m, 1);
    }
  }

  async function load() {
    clearError();

    // URLを揃える（戻る/進む/モード変更で date が飛ぶ事故防止）
    setQs("mode", mode);
    syncDateParamToUrl(anchorMs);
    setActiveMode(mode);

    const datePicker = document.getElementById("datePicker");
    if (datePicker) datePicker.value = isoDateForPickerFromAnchorMs(anchorMs);

    const r = computeRange(anchorMs, mode);
    buildTimeColumn();
    buildGridShell(r.startMs, r.days);

    const projects = await apiJson("/api/projects");
    const shortageIdSet = await buildShortageIdSet(projects || []);
    renderProjects(projects || [], r.startMs, r.days, shortageIdSet);
  }

  function wire() {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const newBtn = document.getElementById("newBtn");
    const datePicker = document.getElementById("datePicker");

    if (prevBtn) prevBtn.addEventListener("click", () => {
      shiftAnchor(-1);
      load().catch(e => showError(e.message));
    });

    if (nextBtn) nextBtn.addEventListener("click", () => {
      shiftAnchor(1);
      load().catch(e => showError(e.message));
    });

    if (newBtn) newBtn.addEventListener("click", () => {
      const ret = encodeURIComponent(location.pathname + location.search);
      location.href = `/project-new.html?return=${ret}`;
    });

    if (datePicker) {
      datePicker.addEventListener("change", () => {
        const v = datePicker.value;
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
        const [y, m, d] = v.split("-").map(Number);
        if (![y, m, d].every(Number.isFinite)) return;
        anchorMs = jstMidnightUtcMs(y, m, d);
        load().catch(e => showError(e.message));
      });
    }

    for (const id of ["modeDay", "modeWeek", "mode2Week", "modeMonth"]) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener("click", () => {
        mode = btn.getAttribute("data-mode") || "week";
        load().catch(e => showError(e.message));
      });
    }
  }

  // 画面が真っ白になる系を潰す（例外を必ず表示）
  window.addEventListener("error", (ev) => {
    const msg = ev?.error?.message || ev?.message || "不明なエラー";
    showError("画面エラー: " + msg);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const msg = ev?.reason?.message || String(ev?.reason || "不明なエラー");
    showError("通信/処理エラー: " + msg);
  });

  wire();
  load().catch(e => showError(e.message));
})();