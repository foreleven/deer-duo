/**
 * Test setup helper: applies all migrations to the test D1 database and
 * returns a login cookie for the seeded admin or a regular user.
 *
 * This runs inside the Miniflare Workers runtime thanks to
 * @cloudflare/vitest-pool-workers, so `env` is the real Workers binding.
 *
 * Each DDL/DML statement is run individually via db.prepare().run() to avoid
 * D1 multi-statement exec() limitations in the Miniflare sandbox.
 */
import { env, SELF } from "cloudflare:test";

/** Apply all migrations to the test D1 database. Idempotent (uses IF NOT EXISTS). */
export async function applyMigrations(): Promise<void> {
  const db = (env as { DB: D1Database }).DB;

  // ── migration 0001: users ───────────────────────────────────────────────────
  // Run each statement individually to avoid batch() ordering issues
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO users (username, password_hash, salt, role) VALUES (
        'admin',
        '1734f186dc6e48c93cfb64aeaa28d5942a94c8bf8631621212c739f938faf8e1',
        'a7f3d2e1b4c5906f82d14e3b7a0c9e8f',
        'admin'
      )`,
    )
    .run();

  // ── migration 0002: course management ──────────────────────────────────────
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS subjects (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        code       TEXT NOT NULL UNIQUE,
        name       TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO subjects (code, name, sort_order) VALUES ('chinese', '语文', 1)`,
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO subjects (code, name, sort_order) VALUES ('math', '数学', 2)`,
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO subjects (code, name, sort_order) VALUES ('english', '英语', 3)`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS chapters (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS lessons (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        content    TEXT,
        tags       TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS study_records (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        study_date TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, lesson_id, study_date)
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tasks (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        study_record_id  INTEGER NOT NULL REFERENCES study_records(id) ON DELETE CASCADE,
        task_type        TEXT NOT NULL CHECK (task_type IN ('homework', 'recitation', 'preview', 'review')),
        note             TEXT,
        status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
        completed_at     DATETIME,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

/** Login via POST /api/login and return the Set-Cookie header value. */
export async function loginAs(
  username: string,
  password: string,
): Promise<string> {
  const res = await SELF.fetch("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed for ${username}: ${res.status} ${await res.text()}`,
    );
  }
  const cookie = res.headers.get("Set-Cookie") ?? "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) throw new Error(`No token cookie returned for ${username}`);
  return `token=${match[1]}`;
}

/** Convenience: create a regular user and return their cookie. */
export async function createUserAndLogin(
  username: string,
): Promise<{ cookie: string; userId: number }> {
  const db = (env as { DB: D1Database }).DB;

  // Insert a test user with the same password hash/salt as the seeded admin
  // (password = "admin123") so we can log in via the real /api/login endpoint.
  await db
    .prepare(
      "INSERT OR IGNORE INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
    )
    .bind(
      username,
      "1734f186dc6e48c93cfb64aeaa28d5942a94c8bf8631621212c739f938faf8e1",
      "a7f3d2e1b4c5906f82d14e3b7a0c9e8f",
      "user",
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number }>();

  const cookie = await loginAs(username, "admin123");
  return { cookie, userId: row!.id };
}

