const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(path.join(__dirname, '../data/mailserver.db'));

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Emails table
    db.run(`CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_email TEXT,
        to_email TEXT,
        subject TEXT,
        body TEXT,
        html TEXT,
        received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT 0,
        folder TEXT DEFAULT 'inbox'
    )`);
});

module.exports = db;