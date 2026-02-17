require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

// authルート
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// /api 配下に auth ルートを接続（/api/login）
app.use("/api", authRoutes);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection error");
  }
});

app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin','staff')) NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  venue TEXT,
  person_in_charge TEXT,
  status TEXT CHECK (status IN ('draft','confirmed','cancelled')) DEFAULT 'draft',
  shipping_type TEXT CHECK (shipping_type IN ('near','far','carry')),
  shipping_date DATE,
  usage_start TIMESTAMP NOT NULL,
  usage_end TIMESTAMP,
  arrival_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_items (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_template_items (
  template_id INTEGER REFERENCES checklist_templates(id) ON DELETE CASCADE,
  equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
  default_quantity INTEGER NOT NULL
);
    `);

    res.send("Database initialized");
  } catch (err) {
    console.error(err);
    res.status(500).send("Initialization error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
