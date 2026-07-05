CREATE DATABASE IF NOT EXISTS kill_leaderboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kill_leaderboard;

CREATE TABLE IF NOT EXISTS players (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(16) NOT NULL,
  uuid          VARCHAR(36) NOT NULL UNIQUE,       -- Ginawang NOT NULL at UNIQUE para sa automatic sync
  kills         INT UNSIGNED NOT NULL DEFAULT 0,
  deaths        INT UNSIGNED NOT NULL DEFAULT 0,
  online        BOOLEAN     NOT NULL DEFAULT FALSE,
  last_seen     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_kills (kills DESC)
) ENGINE=InnoDB;

-- Pangsampol na data na may legal at kumpletong UUID blocks
INSERT INTO players (username, uuid, kills, online) VALUES
  ('Juszzz', '8667ba71-b85a-4004-af54-457a9734eed7', 4821, TRUE),
  ('Dream', 'ec1375dc-a603-4253-9662-7f11898e1cd3', 4390, TRUE)
ON DUPLICATE KEY UPDATE username = username;