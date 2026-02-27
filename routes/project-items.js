// routes/project-items.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/project-items?project_id=1
 */
router.get("/", async (req, res) => {
  try {
    const project_id = req.query.project_id;
    if (!project_id) {
      return res.status(400).json({ error: "project_id required" });
    }
    const result = await db.query(
      `SELECT equipment_id, quantity
       FROM project_items
       WHERE project_id = $1
       ORDER BY equipment_id ASC`,
      [project_id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project items" });
  }
});

/**
 * GET /api/project-items/detail?project_id=1
 */
router.get("/detail", async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: "project_id required" });
    }
    const result = await db.query(
      `SELECT pi.id, pi.equipment_id, pi.quantity, pi.checked,
              e.name AS equipment_name
       FROM project_items pi
       JOIN equipment e ON e.id = pi.equipment_id
       WHERE pi.project_id = $1
       ORDER BY e.name ASC`,
      [project_id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch detail" });
  }
});

/**
 * POST /api/project-items
 */
router.post("/", async (req, res) => {
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
        `INSERT INTO project_items (project_id, equipment_id, quantity)
         VALUES ($1, $2, $3)`,
        [project_id, equipment_id, quantity]
      );
    }
    await db.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    try { await db.query("ROLLBACK"); } catch (e) {}
    console.error(err);
    res.status(500).json({ error: "Failed to save project items" });
  }
});

/**
 * PATCH /api/project-items/:id/check
 */
router.patch("/:id/check", async (req, res) => {
  try {
    const { id } = req.params;
    const { checked } = req.body;
    if (typeof checked !== "boolean") {
      return res.status(400).json({ error: "checked must be boolean" });
    }
    const result = await db.query(
      `UPDATE project_items SET checked = $1 WHERE id = $2 RETURNING *`,
      [checked, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update check" });
  }
});

module.exports = router;