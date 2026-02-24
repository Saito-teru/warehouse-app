// routes/project-items.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/project-items?project_id=1
 * 返却: { items: [{equipment_id, quantity}, ...] }
 */
router.get("/project-items", async (req, res) => {
  try {
    const project_id = req.query.project_id;

    if (!project_id) {
      return res.status(400).json({ error: "project_id required" });
    }

    const result = await db.query(
      `
      SELECT equipment_id, quantity
      FROM project_items
      WHERE project_id = $1
      ORDER BY equipment_id ASC
      `,
      [project_id]
    );

    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project items" });
  }
});

/**
 * POST /api/project-items
 * body: { project_id, items:[{equipment_id, quantity}, ...] }
 * 仕様: いったん全削除して入れ直し（シンプルで壊れにくい）
 */
router.post("/project-items", async (req, res) => {
  try {
    const { project_id, items } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: "project_id required" });
    }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be array" });
    }

    await db.query("BEGIN");

    await db.query("DELETE FROM project_items WHERE project_id = $1", [project_id]);

    for (const it of items) {
      const equipment_id = it.equipment_id;
      const quantity = Number(it.quantity);

      if (!equipment_id) continue;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      await db.query(
        `
        INSERT INTO project_items (project_id, equipment_id, quantity)
        VALUES ($1, $2, $3)
        `,
        [project_id, equipment_id, quantity]
      );
    }

    await db.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch (e) {}
    console.error(err);
    res.status(500).json({ error: "Failed to save project items" });
  }
});

module.exports = router;
