// server/index.js
console.log('=== START: index.js wird ausgeführt ==='); // <-- NEUE START-LOG-ZEILE

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database'); // <--- CRASH-PUNKT?
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- API ENDPUNKTE ---

// Daten laden (ersetzt localStorage.getItem)
app.get('/api/storage/:key', (req, res) => {
    const key = req.params.key;
    db.get("SELECT value FROM storage WHERE key = ?", [key], (err, row) => {
        if (err) {
            console.error("Datenbank Fehler beim Laden:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row ? JSON.parse(row.value) : null);
    });
});

// Daten speichern (ersetzt localStorage.setItem)
app.post('/api/storage', (req, res) => {
    const { key, value } = req.body;
    const jsonValue = JSON.stringify(value);

    db.run(`INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)`, [key, jsonValue], function(err) {
        if (err) {
            console.error("Datenbank Fehler beim Speichern:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// --- FRONTEND AUSLIEFERN ---
app.use(express.static(path.join(__dirname, '../dist')));

// Serve SPA fallback for any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// SERVER START
app.listen(PORT, () => {
    console.log(`Server läuft erfolgreich auf Port ${PORT}`); // <-- Dies sollte erscheinen!
});
