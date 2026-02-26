// warehouse-app/routes/projects.js
// projects テーブル列: usage_start / usage_end を正として運用する版（完全差し替え用）

const express = require("express");
const router = express.Router();
const pool = require("../db");

// ===== util =====
function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// color_key: null or 1..12 integer
function normalizeColorKey(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  const x = Math.floor(n);
  if (x < 1 || x > 12) return NaN;
  return x;
}

function isValidStatus(status) {
  return status === null || status === undefined || ["draft", "confirmed", "cancelled"].includes(status);
}

function isValidShippingType(t) {
  return t === null || t === undefined || t === "" || ["near", "far", "carry"].includes(t);
}

/**
 * timestamptz に入れる「タイムゾーン付きISO文字列」だけを許可する。
 * 例: 2026-02-19T01:00:00.000Z / 2026-02-19T10:00:00+09:00
 *
 * 注意:
 * - "2026-02-19T10:00"（Z無し）は環境依存で解釈がブレるので拒否する
 * - Date(...) で再解釈→toISOString() もしない（ズレの温床になるため）
 */
function normalizeTzIso(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;

  // YYYY-MM-DDTHH:MM(:SS(.sss))?(Z|±HH:MM)
  const re =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+\-]\d{2}:\d{2})$/;

  if (!re.test(s)) return NaN;
  return s;
}

// 互換入力: usage_start_at / usage_start のどちらでも受ける
function pickUsageStart(body) {
  return body.usage_start_at ?? body.usage_start ?? body.usageStart ?? null;
}
function pickUsageEnd(body) {
  return body.usage_end_at ?? body.usage_end ?? body.usageEnd ?? null;
}

// 互換出力: usage_start_at / usage_end_at を必ず付与
function withCompatFields(p) {
  return {
    ...p,
    usage_start_at: p.usage_start,
    usage_end_at: p.usage_end,
  };
}

// ===== GET /api/projects =====
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        id,
        title,
        client_name,
        venue,
        person_in_charge,
        status,
        shipping_type,
        shipping_date,
        usage_start,
        usage_end,
        arrival_date,
        created_at,
        color_key
      FROM public.projects
      ORDER BY usage_start ASC NULLS LAST, id ASC
    `);

    res.json(r.rows.map(withCompatFields));
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

    const r = await pool.query(
      `
      SELECT
        id,
        title,
        client_name,
        venue,
        person_in_charge,
        status,
        shipping_type,
        shipping_date,
        usage_start,
        usage_end,
        arrival_date,
        created_at,
        color_key
      FROM public.projects
      WHERE id = $1
    `,
      [id]
    );

    if (!r.rows.length) return res.status(404).json({ error: "project not found" });

    res.json(withCompatFields(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== POST /api/projects =====
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};

    const {
      title,
      client_name,
      venue,
      person_in_charge,
      status,
      shipping_type,
      shipping_date,
      color_key,
    } = body;

    if (!isValidStatus(status)) return res.status(400).json({ error: "status が不正です" });
    if (!isValidShippingType(shipping_type)) return res.status(400).json({ error: "shipping_type が不正です" });

    const startIso = normalizeTzIso(pickUsageStart(body));
    const endIso = normalizeTzIso(pickUsageEnd(body));
    if (Number.isNaN(startIso) || Number.isNaN(endIso)) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) はタイムゾーン付きISO（末尾Z等）で送ってください" });
    }
    if (!startIso || !endIso) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) は必須です" });
    }

    // ここだけ Date 比較（ISOの比較は危険なので、UTCとして比較するため Date を使う）
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) が日時として解釈できません" });
    }
    if (e <= s) return res.status(400).json({ error: "使用終了は使用開始より後である必要があります" });

    const ck = normalizeColorKey(color_key);
    if (Number.isNaN(ck)) return res.status(400).json({ error: "color_key が不正です（1〜12 または未指定）" });

    const r = await pool.query(
      `
      INSERT INTO public.projects
        (title, client_name, venue, person_in_charge, status, shipping_type, shipping_date, usage_start, usage_end, color_key)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        id,
        title,
        client_name,
        venue,
        person_in_charge,
        status,
        shipping_type,
        shipping_date,
        usage_start,
        usage_end,
        arrival_date,
        created_at,
        color_key
    `,
      [
        normalizeText(title),
        normalizeText(client_name),
        normalizeText(venue),
        normalizeText(person_in_charge),
        status ?? "draft",
        shipping_type ?? null,
        shipping_date ?? null,
        startIso, // 文字列のまま渡す（再変換しない）
        endIso,   // 文字列のまま渡す（再変換しない）
        ck,
      ]
    );

    res.status(201).json(withCompatFields(r.rows[0]));
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

    const body = req.body || {};

    const {
      title,
      client_name,
      venue,
      person_in_charge,
      status,
      shipping_type,
      shipping_date,
      color_key,
    } = body;

    if (!isValidStatus(status)) return res.status(400).json({ error: "status が不正です" });
    if (!isValidShippingType(shipping_type)) return res.status(400).json({ error: "shipping_type が不正です" });

    const startIso = normalizeTzIso(pickUsageStart(body));
    const endIso = normalizeTzIso(pickUsageEnd(body));
    if (Number.isNaN(startIso) || Number.isNaN(endIso)) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) はタイムゾーン付きISO（末尾Z等）で送ってください" });
    }
    if (!startIso || !endIso) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) は必須です" });
    }

    const s = new Date(startIso);
    const e = new Date(endIso);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ error: "usage_start(_at) / usage_end(_at) が日時として解釈できません" });
    }
    if (e <= s) return res.status(400).json({ error: "使用終了は使用開始より後である必要があります" });

    const ck = normalizeColorKey(color_key);
    if (Number.isNaN(ck)) return res.status(400).json({ error: "color_key が不正です（1〜12 または未指定）" });

    const r = await pool.query(
      `
      UPDATE public.projects
      SET
        title = $1,
        client_name = $2,
        venue = $3,
        person_in_charge = $4,
        status = $5,
        shipping_type = $6,
        shipping_date = $7,
        usage_start = $8,
        usage_end   = $9,
        color_key = $10
      WHERE id = $11
      RETURNING
        id,
        title,
        client_name,
        venue,
        person_in_charge,
        status,
        shipping_type,
        shipping_date,
        usage_start,
        usage_end,
        arrival_date,
        created_at,
        color_key
    `,
      [
        normalizeText(title),
        normalizeText(client_name),
        normalizeText(venue),
        normalizeText(person_in_charge),
        status ?? "draft",
        shipping_type ?? null,
        shipping_date ?? null,
        startIso, // 文字列のまま渡す（再変換しない）
        endIso,   // 文字列のまま渡す（再変換しない）
        ck,
        id,
      ]
    );

    if (!r.rows.length) return res.status(404).json({ error: "project not found" });

    res.json(withCompatFields(r.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;