// routes/qr.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/qr
 * QRコードがある機材一覧を返す
 */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, total_quantity, qr_png_base64, created_at
       FROM equipment
       WHERE qr_png_base64 IS NOT NULL
       ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/qr error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

/**
 * POST /api/qr/scan
 * QRスキャン処理
 */
router.post("/scan", async (req, res) => {
  try {
    const { equipment_id, qr_text } = req.body;
    let id = null;

    if (equipment_id !== undefined && equipment_id !== null) {
      id = Number(equipment_id);
    } else if (qr_text !== undefined && qr_text !== null) {
      id = Number(String(qr_text).trim());
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "equipment_id must be a positive integer" });
    }

    const result = await db.query(
      `SELECT id, name, total_quantity, qr_png_base64
       FROM equipment WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "equipment not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/qr/scan error:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;