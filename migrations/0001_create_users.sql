-- Migration: 0001_create_users
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed built-in admin account
-- Username: admin
-- Password: admin123
-- Hash algorithm: PBKDF2-SHA256, 100000 iterations, 256-bit key
-- To reset password: derive new PBKDF2 hash and update password_hash + salt here
INSERT OR IGNORE INTO users (username, password_hash, salt, role)
VALUES (
  'admin',
  '1734f186dc6e48c93cfb64aeaa28d5942a94c8bf8631621212c739f938faf8e1',
  'a7f3d2e1b4c5906f82d14e3b7a0c9e8f',
  'admin'
);
