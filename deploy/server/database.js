const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'tennis.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ FATAL DB-FEHLER: Konnte nicht zur SQLite Datenbank verbinden:', err.message);
    // Beenden Sie den Prozess, wenn die DB nicht gestartet werden kann
    process.exit(1); 
  } else {
    console.log('✅ Verbunden zur SQLite Datenbank.');
  }
});

// Erstellt die Tabelle, falls sie nicht existiert
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
});

module.exports = db;