// Migration Script: Lokale SQLite → Turso Cloud
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');

const localDb = new sqlite3.Database('./tennis.db');

const tursoDb = createClient({
  url: 'libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQ3MTI3MzMsImlkIjoiNWNmMTliZmEtMTZjYS00NGI5LWI4ZmItMmFhMDQ1ZGRjYmI0IiwicmlkIjoiMjc4ZTJkODItYWQ1MC00OTlkLWFiMjctYjgxZmI5OTAxNDY0In0.8flxkNvAFnlGwE5KwSMRu47zw7KwODJO7X8HYr5gLMMo78s7jAzGNGLnN7K_tVhElJQA_Yr7PgXxlI3xMB0TDw'
});

async function migrate() {
  console.log('🚀 Starte Migration: Lokale SQLite → Turso Cloud\n');

  // Stelle sicher, dass die Tabelle existiert
  await tursoDb.execute(`
    CREATE TABLE IF NOT EXISTS storage (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Hole alle Daten aus lokaler DB
  localDb.all('SELECT key, value FROM storage', [], async (err, rows) => {
    if (err) {
      console.error('❌ Fehler beim Lesen der lokalen DB:', err);
      process.exit(1);
    }

    console.log(`📦 ${rows.length} Einträge gefunden\n`);

    for (const row of rows) {
      try {
        await tursoDb.execute({
          sql: 'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)',
          args: [row.key, row.value]
        });
        const size = row.value ? row.value.length : 0;
        console.log(`  ✅ ${row.key} (${size} bytes)`);
      } catch (e) {
        console.error(`  ❌ ${row.key}: ${e.message}`);
      }
    }

    console.log('\n🎉 Migration abgeschlossen!');
    console.log('   Deine Daten sind jetzt in Turso Cloud gespeichert.');
    
    localDb.close();
    process.exit(0);
  });
}

migrate();
