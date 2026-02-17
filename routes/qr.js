// routes/qr.js（完全版）
const express = require("express");
const router = express.Router();

const db = require("../db");

// 認証を掛けたい場合は有効化してください（あなたの環境に合わせる）
// 既に middleware/auth.js がある前提で読み込みだけ用意します。
// routes/auth.js と整合が取れていない場合は一旦コメントアウトして動作優先にしてください。
let authMiddleware = null;
try {
  authMiddleware = require("../middleware/auth");
} catch (e) {
  authMiddleware = null;
}

// 認証を掛けるかどうか（まずは動作優先：false推奨）
// ここを true にすると、Authorization: Bearer <token> が必要になります。
const REQUIRE_AUTH = false;

// ミドルウェアを付けるヘルパ
function maybeAuth(req, res, next) {
  if (!REQUIRE_AUTH) return next();
  if (!authMiddleware) return res.status(500).json({ error: "auth middleware not found" });
  return authMiddleware(req, res, next);
}

/**
 * GET /qr-list
 * server.js 側で app.use("/api", qrRoutes) しているので
 * 最終URLは GET /api/qr-list
 */
router.get("/qr-list", maybeAuth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, name, total_quantity, current_quantity, qr_png_base64, created_at
      FROM equipment
      WHERE qr_png_base64 IS NOT NULL
      ORDER BY id ASC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/qr-list error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /qr-scan
 * 最終URLは POST /api/qr-scan
 *
 * 受け取り例：
 *  1) { "equipment_id": 12 }
 *  2) { "qr_text": "12" }  // QRがidのみの文字列想定
 *
 * 動作：
 *  - 対象equipmentを取得
 *  - current_quantity を +1（上限は total_quantity）
 *  - 更新後のレコードを返す
 */
router.post("/qr-scan", maybeAuth, async (req, res) => {
  const client = await db.connect();

  try {
    const { equipment_id, qr_text } = req.body;

    let id = null;

    if (equipment_id !== undefined && equipment_id !== null) {
      id = Number(equipment_id);
    } else if (qr_text !== undefined && qr_text !== null) {
      // QRは equipment.id のみ、という仕様なので数値化
      id = Number(String(qr_text).trim());
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "equipment_id (or qr_text) must be a positive integer" });
    }

    await client.query("BEGIN");

    const found = await client.query(
      `
      SELECT id, name, total_quantity, current_quantity, qr_png_base64
      FROM equipment
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "equipment not found" });
    }

    const eq = found.rows[0];

    const total = Number(eq.total_quantity);
    const current = Number(eq.current_quantity);

    // 上限は total_quantity（在庫概念を壊さないため）
    const nextQty = Math.min(total, current + 1);
    const capped = nextQty === total && current + 1 > total;

    const updated = await client.query(
      `
      UPDATE equipment
      SET current_quantity = $1
      WHERE id = $2
      RETURNING id, name, total_quantity, current_quantity, qr_png_base64
      `,
      [nextQty, id]
    );

    await client.query("COMMIT");

    return res.json({
      ...updated.rows[0],
      warning: capped ? "current_quantity reached total_quantity (capped)" : null,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("POST /api/qr-scan error:", err);
    return res.status(500).json({ error: "internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
