// warehouse-app/routes/projects.js（venue + color_key 永続化対応：完全置き換え）
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ===== 共通ユーティリティ =====
function toDateOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d;
}

function toISO(d) {
  return d ? d.toISOString() : null;
}

function isValidStatus(status) {
  return ["draft", "confirmed", "cancelled"].includes(status);
}

function isValidShippingType(t) {
  return t === null || t === "" || ["near", "far", "carry"].includes(t);
}

// venue: 空文字は null に寄せる
function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// color_key: null or 1..12 の整数のみ許可
function normalizeColorKey(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  const x = Math.floor(n);
  if (x < 1 || x > 12) return NaN;
  return x;
}

// ===== GET /api/projects =====
router.get("/", async (req, res) => {
  try {
    // * で返す（venue/color_key も含まれる）
    const q = `SELECT * FROM projects ORDER BY usage_start_at ASC NULLS LAST, id ASC`;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== GET /api/projects/:id =====
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: "project_id が不正です。" });
    }

    const q = `SELECT * FROM projects WHERE id = $1`;
    const r = await pool.query(q, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "project not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== POST /api/projects =====
router.post("/", async (req, res) => {
  try {
    const {
      title,
      client_name,
      venue,
      color_key,          // ★追加
      status,
      shipping_type,
      shipping_date,
      return_due_date,
      usage_start_at,
      usage_end_at,
    } = req.body || {};

    if (!usage_start_at || !usage_end_at) {
      return res.status(400).json({ error: "usage_start_at と usage_end_at は必須です" });
    }

    const start = toDateOrNull(usage_start_at);
    const end = toDateOrNull(usage_end_at);

    if (!start || !end) {
      return res.status(400).json({ error: "usage_start_at / usage_end_at が日時として解釈できません" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "使用終了は使用開始より後である必要があります" });
    }

    if (status && !isValidStatus(status)) {
      return res.status(400).json({ error: "status が不正です" });
    }
    if (!isValidShippingType(shipping_type ?? null)) {
      return res.status(400).json({ error: "shipping_type が不正です" });
    }

    const ck = normalizeColorKey(color_key);
    if (Number.isNaN(ck)) {
      return res.status(400).json({ error: "color_key が不正です（1〜12 または未指定）" });
    }

    const q = `
      INSERT INTO projects
        (title, client_name, venue, color_key, status, shipping_type, shipping_date, return_due_date, usage_start_at, usage_end_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;

    const params = [
      normalizeText(title),
      normalizeText(client_name),
      normalizeText(venue),
      ck,
      status ?? "draft",
      shipping_type ?? null,
      shipping_date ?? null,
      return_due_date ?? null,
      toISO(start),
      toISO(end),
    ];

    const r = await pool.query(q, params);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== PUT /api/projects/:id =====
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: "project_id が不正です。" });
    }

    const {
      title,
      client_name,
      venue,
      color_key,          // ★追加
      status,
      shipping_type,
      shipping_date,
      return_due_date,
      usage_start_at,
      usage_end_at,
    } = req.body || {};

    if (!usage_start_at || !usage_end_at) {
      return res.status(400).json({ error: "usage_start_at と usage_end_at は必須です" });
    }

    const start = toDateOrNull(usage_start_at);
    const end = toDateOrNull(usage_end_at);

    if (!start || !end) {
      return res.status(400).json({ error: "usage_start_at / usage_end_at が日時として解釈できません" });
    }

    if (end <= start) {
      return res.status(400).json({ error: "使用終了は使用開始より後である必要があります" });
    }

    if (status && !isValidStatus(status)) {
      return res.status(400).json({ error: "status が不正です" });
    }
    if (!isValidShippingType(shipping_type ?? null)) {
      return res.status(400).json({ error: "shipping_type が不正です" });
    }

    const ck = normalizeColorKey(color_key);
    if (Number.isNaN(ck)) {
      return res.status(400).json({ error: "color_key が不正です（1〜12 または未指定）" });
    }

    const q = `
      UPDATE projects
      SET
        title = $1,
        client_name = $2,
        venue = $3,
        color_key = $4,
        status = $5,
        shipping_type = $6,
        shipping_date = $7,
        return_due_date = $8,
        usage_start_at = $9,
        usage_end_at = $10
      WHERE id = $11
      RETURNING *
    `;

    const params = [
      normalizeText(title),
      normalizeText(client_name),
      normalizeText(venue),
      ck,
      status ?? "draft",
      shipping_type ?? null,
      shipping_date ?? null,
      return_due_date ?? null,
      toISO(start),
      toISO(end),
      id,
    ];

    const r = await pool.query(q, params);
    if (r.rows.length === 0) return res.status(404).json({ error: "project not found" });

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
