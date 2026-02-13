require("dotenv").config();
const express = require("express");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
