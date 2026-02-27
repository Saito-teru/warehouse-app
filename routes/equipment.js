// routes/equipment.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const QRCode = require("qrcode");

/**
 * GET /api/equipment
 */
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, total_quantity, image_url, qr_png_base64, created_at
      FROM equipment
      ORDER BY id ASC
    `);
    res.json({ equipment: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

/**
 * GET /api/equipment/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, name, total_quantity, image_url, qr_png_base64, created_at
       FROM equipment WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

/**
 * POST /api/equipment
 * 機材登録時にQRを自動生成
 */
router.post("/", async (req, res) => {
  try {
    const { name, total_quantity, image_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!total_quantity || Number(total_quantity) <= 0) {
      return res.status(400).json({ error: "total_quantity must be positive" });
    }

    // まず機材を登録してIDを取得
    const inserted = await db.query(
      `INSERT INTO equipment (name, total_quantity, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, name, total_quantity, image_url, created_at`,
      [name, Number(total_quantity), image_url || null]
    );

    const eq = inserted.rows[0];

    // IDをもとにQRコードを生成（equipment.idのみ含む）
    const qrDataUrl = await QRCode.toDataURL(String(eq.id), {
      width: 200,
      margin: 2,
    });

    // base64部分のみ抽出（data:image/png;base64, を除く）
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");

    // QRをDBに保存
    const updated = await db.query(
      `UPDATE equipment SET qr_png_base64 = $1 WHERE id = $2
       RETURNING id, name, total_quantity, image_url, qr_png_base64, created_at`,
      [qrBase64, eq.id]
    );

    res.status(201).json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create equipment" });
  }
});

/**
 * PUT /api/equipment/:id
 * 機材更新
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, total_quantity, image_url } = req.body;

    const result = await db.query(
      `UPDATE equipment
       SET name = COALESCE($1, name),
           total_quantity = COALESCE($2, total_quantity),
           image_url = COALESCE($3, image_url)
       WHERE id = $4
       RETURNING id, name, total_quantity, image_url, qr_png_base64, created_at`,
      [name || null, total_quantity ? Number(total_quantity) : null, image_url || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update equipment" });
  }
});

module.exports = router;