const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const configuredPath = process.env.DB_PATH || path.join(__dirname, 'lakeside.db');
const databasePath = path.resolve(configuredPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    specialty TEXT NOT NULL,
    doctor TEXT NOT NULL,
    appointmentDateTime TEXT NOT NULL,
    patientName TEXT NOT NULL,
    patientPhone TEXT NOT NULL,
    patientEmail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Booked',
    stripeSessionId TEXT,
    confirmationEmailSentAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Additive migration: existing users remain patients unless explicitly promoted below.
const userColumns = db.prepare('PRAGMA table_info(users)').all();
if (!userColumns.some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'patient'");
}

// Additive migration: keep existing appointment rows intact when upgrading.
const appointmentColumns = db.prepare('PRAGMA table_info(appointments)').all();
if (!appointmentColumns.some((column) => column.name === 'stripeSessionId')) {
  db.exec('ALTER TABLE appointments ADD COLUMN stripeSessionId TEXT');
}
if (!appointmentColumns.some((column) => column.name === 'confirmationEmailSentAt')) {
  db.exec('ALTER TABLE appointments ADD COLUMN confirmationEmailSentAt TEXT');
}

// Seed the staff account without ever storing or logging the plaintext password.
const receptionEmail = (process.env.RECEPTION_EMAIL || 'reception@lakeside.local').trim().toLowerCase();
const receptionPassword = process.env.RECEPTION_PASSWORD;
if (!receptionPassword) {
  console.warn('RECEPTION_PASSWORD is not configured; the reception staff account was not seeded.');
} else {
  const passwordHash = bcrypt.hashSync(receptionPassword, 12);
  const existingReceptionUser = db.prepare('SELECT id FROM users WHERE email = ?').get(receptionEmail);
  if (!existingReceptionUser) {
    db.prepare(`
      INSERT INTO users (patientName, email, passwordHash, role)
      VALUES (?, ?, ?, 'reception')
    `).run('Reception', receptionEmail, passwordHash);
  } else {
    db.prepare("UPDATE users SET role = 'reception', passwordHash = ? WHERE id = ?").run(passwordHash, existingReceptionUser.id);
  }
}

module.exports = db;
