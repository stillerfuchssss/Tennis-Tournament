const { createClient } = require('@libsql/client');

// Turso Cloud Database
const url = process.env.TURSO_DATABASE_URL || 'libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQ3MTI3MzMsImlkIjoiNWNmMTliZmEtMTZjYS00NGI5LWI4ZmItMmFhMDQ1ZGRjYmI0IiwicmlkIjoiMjc4ZTJkODItYWQ1MC00OTlkLWFiMjctYjgxZmI5OTAxNDY0In0.8flxkNvAFnlGwE5KwSMRu47zw7KwODJO7X8HYr5gLMMo78s7jAzGNGLnN7K_tVhElJQA_Yr7PgXxlI3xMB0TDw';

const client = createClient({
  url: url,
  authToken: authToken
});

// Masked URL for logging
const maskedUrl = url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

// Initialisiere Tabelle & Verbindungstest
const initDB = async () => {
  console.log(`🔍 Teste Verbindung zu: ${maskedUrl}`);
  try {
    // Verbindungstest: Ein einfaches Query
    await client.execute("SELECT 1");
    console.log('✅ Verbindungstest erfolgreich!');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('✅ Datenbank-Schema verifiziert.');
    return true;
  } catch (err) {
    console.error('❌ KRITISCHER DATENBANK-FEHLER:', err.message);
    if (err.message.includes('auth')) {
      console.error('👉 TIP: Prüfe dein Auth-Token (scheint ungültig zu sein)');
    } else if (err.message.includes('fetch')) {
      console.error('👉 TIP: Netzwerk-Fehler. Prüfe deine Internetverbindung oder Hostname.');
    }
    return false;
  }
};

// Wrapper-Objekt mit async Methoden und Logging
const db = {
  get: async (query, params, callback) => {
    try {
      const result = await client.execute({ sql: query, args: params || [] });
      const row = result.rows[0] || null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      console.error(`❌ DB GET Fehler [${query}]:`, err.message);
      if (callback) callback(err);
      throw err;
    }
  },

  run: async (query, params, callback) => {
    try {
      await client.execute({ sql: query, args: params || [] });
      if (callback) callback(null);
      return true;
    } catch (err) {
      console.error(`❌ DB RUN Fehler [${query}]:`, err.message);
      if (callback) callback(err);
      throw err;
    }
  },

  all: async (query, params, callback) => {
    try {
      const result = await client.execute({ sql: query, args: params || [] });
      if (callback) callback(null, result.rows);
      return result.rows;
    } catch (err) {
      console.error(`❌ DB ALL Fehler [${query}]:`, err.message);
      if (callback) callback(err);
      throw err;
    }
  }
};

module.exports = { db, initDB };