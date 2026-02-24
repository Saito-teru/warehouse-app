// routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * POST /login
 * body: { email }
 * 仕様:
 * - emailだけでログイン（パスワード不要）
 * - users に該当emailが無ければ自動作成（admin扱い）
 * - token を返す
 */
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // usersテーブルから検索
    const found = await db.query(
      "SELECT id, name, email, role FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    let user = found.rows[0];

    // 無ければ自動作成
    if (!user) {
      const created = await db.query(
        `
        INSERT INTO users (name, email, role)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, role
        `,
        ["Admin", email, "admin"]
      );
      user = created.rows[0];
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
