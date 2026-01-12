// server/index.js
console.log('=== START: index.js wird ausgeführt ===');

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDB } = require('./database'); // Turso DB
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- API ENDPUNKTE ---

// Daten laden (ersetzt localStorage.getItem)
app.get('/api/storage/:key', async (req, res) => {
    const key = req.params.key;
    try {
        const row = await db.get("SELECT value FROM storage WHERE key = ?", [key]);
        res.json(row ? JSON.parse(row.value) : null);
    } catch (err) {
        console.error("Datenbank Fehler beim Laden:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Daten speichern (ersetzt localStorage.setItem)
app.post('/api/storage', async (req, res) => {
    const { key, value } = req.body;
    const jsonValue = JSON.stringify(value);

    try {
        await db.run(`INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)`, [key, jsonValue]);
        res.json({ success: true });
    } catch (err) {
        console.error("Datenbank Fehler beim Speichern:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- FRONTEND AUSLIEFERN ---
// Im Deployment-Ordner sind die dist-Dateien im gleichen Verzeichnis
app.use(express.static(__dirname));

// Serve SPA fallback for any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// SERVER START - erst nach DB-Init
const startServer = async () => {
    await initDB(); // Warte auf Turso-Verbindung
    app.listen(PORT, () => {
        console.log(`🚀 Server läuft auf Port ${PORT} mit Turso Cloud DB`);
    });
};

startServer();