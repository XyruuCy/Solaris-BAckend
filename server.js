// ============================================================
// Kill Leaderboard API + Secured Admin Control Panel Backend
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MySQL connection pool setup
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "", 
  database: process.env.DB_NAME || "kill_leaderboard",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const ONLINE_THRESHOLD_MINUTES = 5;

// ------------------------------------------------------------
// ROOT ROUTE (Fixes "Cannot GET /" error)
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "Solaris Leaderboard API is active.",
    endpoints: {
      leaderboard: "/api/leaderboard",
      health: "/api/health"
    }
  });
});

// ------------------------------------------------------------
// PUBLIC ENDPOINTS
// ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         username,
         uuid,
         kills,
         deaths,
         online,
         (online = 1 AND last_seen >= NOW() - INTERVAL ? MINUTE) AS is_online
       FROM players
       ORDER BY kills DESC, username ASC`,
      [ONLINE_THRESHOLD_MINUTES]
    );

    const players = rows.map((row) => ({
      username: row.username,
      uuid: row.uuid || "",
      kills: row.kills,
      deaths: row.deaths,
      online: !!row.is_online,
    }));

    res.json(players);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ------------------------------------------------------------
// PLUGIN & ADMIN ENDPOINTS
// ------------------------------------------------------------
app.post("/api/kill", async (req, res) => {
  const { uuid, username, amount = 1, secret } = req.body;

  if (process.env.PLUGIN_SECRET && secret !== process.env.PLUGIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!uuid || !username) {
    return res.status(400).json({ error: "Both uuid and username are required" });
  }

  try {
    await pool.query(
      `INSERT INTO players (uuid, username, kills, online, last_seen)
       VALUES (?, ?, ?, TRUE, NOW())
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         kills = kills + VALUES(kills),
         online = TRUE,
         last_seen = NOW()`,
      [uuid, username, amount]
    );
    res.json({ success: true, message: "Auto-synced successfully via UUID" });
  } catch (err) {
    console.error("Error recording kill:", err);
    res.status(500).json({ error: "Failed to record kill" });
  }
});

// Admin Login & Management logic remains the same...
// (Pwede mong i-keep yung dati mong code para sa admin section sa ibaba nito)

app.listen(PORT, () => {
  console.log(`Kill Leaderboard API running on port ${PORT}`);
});
