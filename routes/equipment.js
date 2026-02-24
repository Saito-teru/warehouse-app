// routes/equipment.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/equipment
 * 返却: { equipment: [...] }
 * project-items.html がこのAPIを使って機材一覧を表示する
 */
router.get("/equipment", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        name,
        total_quantity,
        current_quantity,
        qr_png_base64,
        created_at
      FROM equipment
      ORDER BY id ASC
    `);

    res.json({ equipment: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch equipment" });
  }
});

module.exports = router;
