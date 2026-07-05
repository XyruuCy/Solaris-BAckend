// ============================================================
// Kill Leaderboard API + Secured Admin Control Panel Backend
// Express + MySQL backend supporting UUID-based synchronization
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
  password: "", // Sapilitang blanko para sa XAMPP Linux default configurations
  database: process.env.DB_NAME || "kill_leaderboard",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const ONLINE_THRESHOLD_MINUTES = 5;

// ------------------------------------------------------------
// PUBLIC ENDPOINT: GET /api/leaderboard
// ------------------------------------------------------------
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
// AUTOMATIC PLUGIN ENDPOINT: POST /api/kill (UUID-based auto-sync)
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
    console.error("Error recording kill via plugin:", err);
    res.status(500).json({ error: "Failed to record kill" });
  }
});

// ------------------------------------------------------------
// ADMIN AUTHENTICATION & OVERRIDE ENDPOINTS
// ------------------------------------------------------------

// ADMIN: Verification Endpoint (Login Checking)
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const targetPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (password === targetPassword) {
    const sessionToken = "SECURE_SESSION_" + Buffer.from(targetPassword).toString('base64');
    return res.json({ success: true, token: sessionToken });
  } else {
    return res.status(401).json({ error: "Invalid admin authentication key" });
  }
});

// Middleware helper: Sinisigurong may dalang tamang Token ang bawat Admin Request
async function verifyAdminToken(req, res, next) {
  const token = req.headers["authorization"];
  const targetPassword = process.env.ADMIN_PASSWORD || "admin123";
  const expectedToken = "SECURE_SESSION_" + Buffer.from(targetPassword).toString('base64');

  if (!token || token !== expectedToken) {
    return res.status(403).json({ error: "Access Denied: Unauthorized admin action" });
  }
  next();
}

// ADMIN: Manual Add / Update Player (PROTECTED)
app.post("/api/admin/players", verifyAdminToken, async (req, res) => {
  const { uuid, username, kills, deaths, online } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const activeUuid = uuid || `manual-${Date.now()}`;

  try {
    await pool.query(
      `INSERT INTO players (uuid, username, kills, deaths, online, last_seen)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         kills = VALUES(kills),
         deaths = VALUES(deaths),
         online = VALUES(online),
         last_seen = NOW()`,
      [activeUuid, username, kills || 0, deaths || 0, online ? 1 : 0]
    );
    res.json({ success: true, message: "Player saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save player" });
  }
});

// ADMIN: Manual Delete Player (PROTECTED)
app.delete("/api/admin/players", verifyAdminToken, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    await pool.query(`DELETE FROM players WHERE username = ?`, [username]);
    res.json({ success: true, message: "Player deleted from database" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete player" });
  }
});

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Kill Leaderboard API running on http://localhost:${PORT}`);
});