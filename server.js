require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();

// ===== 基本 =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== public配信 =====
app.use(express.static(path.join(__dirname, "public")));

// ルートで index.html（保険）
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== API routes =====
app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/equipment", require("./routes/equipment"));
app.use("/api/project-items", require("./routes/project-items"));
app.use("/api/shortages", require("./routes/shortages"));
app.use("/api/qr", require("./routes/qr"));

// ===== start =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
