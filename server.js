// server.js（完全版）
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db");

// 既存の認証ルート（POST /login を提供している想定）
const authRoutes = require("./routes/auth");

// QR関連（GET /api/qr-list, POST /api/qr-scan）
const qrRoutes = require("./routes/qr");

const app = express();

// Render / ローカルの両対応
const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;

// 基本ミドルウェア
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// 静的ファイル（public配下）
app.use(express.static(path.join(__dirname, "public")));

// 確認用（疎通チェック）
app.get("/health", (req, res) => {
  res.json({ ok: true, port: PORT });
});

// ルートのマウント
// authRoutes は /login を持っている想定なので、ここは "/" にします
app.use("/", authRoutes);

// QRは /api 配下にまとめる（これにより GET /api/qr-list が成立）
app.use("/api", qrRoutes);

/**
 * equipment API
 * 既にあなたの環境で動作しているとのことですが、
 * この server.js を上書きする以上、最低限の動く実装をここに含めます。
 *
 * エンドポイント:
 *  - POST /equipment
 *  - GET  /equipment
 *  - GET  /equipment/:id
 *
 * QR生成:
 *  - 作成後、equipment.id のみをQR内容としてPNG(base64)を生成し、qr_png_base64 に保存
 */

const QRCode = require("qrcode");

// POST /equipment
app.post("/equipment", async (req, res) => {
  try {
    const { name, total_quantity } = req.body;

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }

    const tq = Number(total_quantity);
    if (!Number.isFinite(tq) || tq < 0) {
      return res.status(400).json({ error: "total_quantity must be a number >= 0" });
    }

    // 1) 先にレコード作成（qrは後でidが確定してから生成）
    const inserted = await db.query(
      `
      INSERT INTO equipment (name, total_quantity, current_quantity)
      VALUES ($1, $2, 0)
      RETURNING id, name, total_quantity, current_quantity, qr_png_base64
      `,
      [String(name).trim(), tq]
    );

    const equipment = inserted.rows[0];

    // 2) equipment.id だけをQR内容にする（文字列化）
    const qrText = String(equipment.id);

    // 3) PNGのDataURL（"data:image/png;base64,..."）を作る
    const dataUrl = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 6,
    });

    // 4) DBには base64本体だけを保存（data:image/png;base64, を外す）
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

    const updated = await db.query(
      `
      UPDATE equipment
      SET qr_png_base64 = $1
      WHERE id = $2
      RETURNING id, name, total_quantity, current_quantity, qr_png_base64
      `,
      [base64, equipment.id]
    );

    return res.status(201).json(updated.rows[0]);
  } catch (err) {
    console.error("POST /equipment error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// GET /equipment
app.get("/equipment", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, name, total_quantity, current_quantity, qr_png_base64, created_at
      FROM equipment
      ORDER BY id ASC
      `
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("GET /equipment error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// GET /equipment/:id
app.get("/equipment/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "invalid id" });
    }

    const result = await db.query(
      `
      SELECT id, name, total_quantity, current_quantity, qr_png_base64, created_at
      FROM equipment
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "equipment not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /equipment/:id error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// 404（APIの取りこぼし確認用）
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.path}`);
});

// 起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
