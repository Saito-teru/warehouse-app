// routes/shortages.js
const express = require("express");
const router = express.Router();
const db = require("../db");

function validateDateStringOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return v; // そのまま返す
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// GET /api/shortages?from=...&to=...
router.get("/", async (req, res) => {
  try {
    const from = validateDateStringOrNull(req.query.from);
    const to = validateDateStringOrNull(req.query.to);

    const projParams = [];
    let projSql = `
      SELECT id, usage_start_at, usage_end_at
      FROM projects
    `;

    if (from && to) {
      projParams.push(to, from);
      projSql += ` WHERE usage_start_at < $1 AND usage_end_at > $2 `;
    } else if (from && !to) {
      projParams.push(from);
      projSql += ` WHERE usage_end_at > $1 `;
    } else if (!from && to) {
      projParams.push(to);
      projSql += ` WHERE usage_start_at < $1 `;
    }

    projSql += ` ORDER BY usage_start_at ASC, id ASC `;

    const projects = (await db.query(projSql, projParams)).rows;
    if (projects.length === 0) return res.json({ projects: [] });

    const ids = projects.map(p => p.id);

    const itemsSql = `
      SELECT
        pi.project_id,
        pi.equipment_id,
        pi.quantity,
        e.name,
        e.total_quantity
      FROM project_items pi
      JOIN equipment e ON e.id = pi.equipment_id
      WHERE pi.project_id = ANY($1::int[])
    `;
    const items = (await db.query(itemsSql, [ids])).rows;

    const projMap = new Map();
    for (const p of projects) {
      projMap.set(p.id, {
        start: new Date(p.usage_start_at),
        end: new Date(p.usage_end_at),
      });
    }

    const eqMap = new Map();
    for (const it of items) {
      if (!eqMap.has(it.equipment_id)) {
        eqMap.set(it.equipment_id, {
          total_quantity: Number(it.total_quantity),
          name: it.name,
        });
      }
    }

    const qtyByProject = new Map();
    for (const it of items) {
      if (!qtyByProject.has(it.project_id)) qtyByProject.set(it.project_id, new Map());
      const m = qtyByProject.get(it.project_id);
      m.set(it.equipment_id, (m.get(it.equipment_id) || 0) + Number(it.quantity));
    }

    const result = [];

    for (const p of projects) {
      const pTime = projMap.get(p.id);
      const pEquip = qtyByProject.get(p.id) || new Map();
      const shortageDetails = [];

      for (const [equipment_id] of pEquip.entries()) {
        const eq = eqMap.get(equipment_id);
        const total = eq ? eq.total_quantity : 0;

        let overlappingDemand = 0;

        for (const other of projects) {
          const oTime = projMap.get(other.id);
          if (!overlaps(pTime.start, pTime.end, oTime.start, oTime.end)) continue;

          const otherEquip = qtyByProject.get(other.id);
          if (!otherEquip) continue;

          overlappingDemand += (otherEquip.get(equipment_id) || 0);
        }

        if (overlappingDemand > total) {
          shortageDetails.push({
            equipment_id,
            name: eq ? eq.name : "",
            total_quantity: total,
            max_overlapping_demand: overlappingDemand,
          });
        }
      }

      result.push({
        project_id: p.id,
        shortage: shortageDetails.length > 0,
        shortage_details: shortageDetails,
      });
    }

    res.json({ projects: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to calculate shortages" });
  }
});

module.exports = router;
