const { createClient } = require('@libsql/client');

// Turso Cloud Database (persistent!)
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQ3MTI3MzMsImlkIjoiNWNmMTliZmEtMTZjYS00NGI5LWI4ZmItMmFhMDQ1ZGRjYmI0IiwicmlkIjoiMjc4ZTJkODItYWQ1MC00OTlkLWFiMjctYjgxZmI5OTAxNDY0In0.8flxkNvAFnlGwE5KwSMRu47zw7KwODJO7X8HYr5gLMMo78s7jAzGNGLnN7K_tVhElJQA_Yr7PgXxlI3xMB0TDw'
});

// Initialisiere Tabelle
const initDB = async () => {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('✅ Verbunden zur Turso Cloud Datenbank (persistent!)');
  } catch (err) {
    console.error('❌ Turso DB-Fehler:', err.message);
    process.exit(1);
  }
};

// Wrapper-Objekt mit async Methoden
const db = {
  get: async (query, params, callback) => {
    try {
      const result = await client.execute({ sql: query, args: params });
      const row = result.rows[0] || null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  },
  
  run: async (query, params, callback) => {
    try {
      await client.execute({ sql: query, args: params });
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  },
  
  all: async (query, params, callback) => {
    try {
      const result = await client.execute({ sql: query, args: params });
      if (callback) callback(null, result.rows);
      return result.rows;
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }
};

module.exports = { db, initDB };