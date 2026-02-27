// routes/shortages.js
const express = require("express");
const router = express.Router();
const db = require("../db");

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

router.get("/", async (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;

    // cancelled以外の全案件を取得
    const projParams = [];
    let projSql = `
      SELECT id, title, status, usage_start, usage_end
      FROM projects
      WHERE status != 'cancelled'
    `;

    if (from && to) {
      projParams.push(to, from);
      projSql += ` AND usage_start < $1 AND usage_end > $2 `;
    } else if (from) {
      projParams.push(from);
      projSql += ` AND usage_end > $1 `;
    } else if (to) {
      projParams.push(to);
      projSql += ` AND usage_start < $1 `;
    }

    projSql += ` ORDER BY usage_start ASC, id ASC `;

    const projects = (await db.query(projSql, projParams)).rows;
    if (projects.length === 0) return res.json({ projects: [] });

    const ids = projects.map(p => p.id);

    // 機材情報取得
    const items = (await db.query(`
      SELECT pi.project_id, pi.equipment_id, pi.quantity,
             e.name, e.total_quantity
      FROM project_items pi
      JOIN equipment e ON e.id = pi.equipment_id
      WHERE pi.project_id = ANY($1::int[])
    `, [ids])).rows;

    // project_id → { equipment_id → quantity }
    const qtyByProject = new Map();
    for (const it of items) {
      if (!qtyByProject.has(it.project_id)) qtyByProject.set(it.project_id, new Map());
      const m = qtyByProject.get(it.project_id);
      m.set(it.equipment_id, (m.get(it.equipment_id) || 0) + Number(it.quantity));
    }

    // equipment_id → { name, total_quantity }
    const eqMap = new Map();
    for (const it of items) {
      if (!eqMap.has(it.equipment_id)) {
        eqMap.set(it.equipment_id, {
          name: it.name,
          total_quantity: Number(it.total_quantity),
        });
      }
    }

    // 不足マークをつける案件IDのSet
    const shortageProjectIds = new Set();

    const eqIds = [...eqMap.keys()];

    for (const eqId of eqIds) {
      const eq = eqMap.get(eqId);
      const total = eq.total_quantity;

      // この機材を使う案件（draft + confirmed）
      const usingProjects = projects.filter(p => {
        const m = qtyByProject.get(p.id);
        return m && m.has(eqId);
      });

      // 各案件について重複需要を計算
      for (const p of usingProjects) {
        const pStart = new Date(p.usage_start);
        const pEnd = new Date(p.usage_end);

        // 重なるすべての案件（draft + confirmed）の合計需要
        let totalDemand = 0;
        const overlappingIds = [];

        for (const other of usingProjects) {
          const oStart = new Date(other.usage_start);
          const oEnd = new Date(other.usage_end);
          if (!overlaps(pStart, pEnd, oStart, oEnd)) continue;
          totalDemand += qtyByProject.get(other.id).get(eqId) || 0;
          overlappingIds.push(other.id);
        }

        if (totalDemand > total) {
          // 重なる案件の中でIDが最大（最後に入力）のものに不足マーク
          const maxId = Math.max(...overlappingIds);
          shortageProjectIds.add(maxId);
        }
      }
    }

    // 結果生成
    const result = projects.map(p => ({
      project_id: p.id,
      shortage: shortageProjectIds.has(p.id),
      shortage_details: [],
    }));

    res.json({ projects: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to calculate shortages" });
  }
});

module.exports = router;