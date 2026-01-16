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

// --- MUTEX LOCK für Race Condition Fix ---
// Serialisiert alle Match-Speicheroperationen, um Überschreibungen zu vermeiden
let matchSaveLock = Promise.resolve();
const acquireMatchLock = () => {
    let release;
    const newLock = new Promise(resolve => { release = resolve; });
    const currentLock = matchSaveLock;
    matchSaveLock = newLock;
    return currentLock.then(() => release);
};

// --- API ENDPUNKTE & LOGGING ---

// Globaler Request Logger
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Daten laden (ersetzt localStorage.getItem)
app.get('/api/storage/:key', async (req, res) => {
    const key = req.params.key;

    // Spezial-Diagnose für Admins (Login)
    if (key === 'tm_admins') {
        console.log('🔑 Login-Versuch erkannt: Lade tm_admins...');
    }

    try {
        const row = await db.get("SELECT value FROM storage WHERE key = ?", [key]);
        const data = row ? JSON.parse(row.value) : null;

        if (key === 'tm_admins') {
            if (data) {
                console.log(`✅ tm_admins gefunden (${data.length} Admins konfiguriert)`);
            } else {
                console.log('⚠️ tm_admins NICHT GEFUNDEN in der Datenbank!');
            }
        }

        res.json(data);
    } catch (err) {
        console.error(`Datenbank Fehler beim Laden [${key}]:`, err.message);
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

// --- ATOMIC MATCH OPERATIONS (Race Condition Fix) ---

// Atomares Match hinzufügen/aktualisieren
// Lädt aktuellen State, fügt Match hinzu, speichert zurück - alles in einer Transaktion
app.put('/api/results/match', async (req, res) => {
    const { playerId, tournamentId, match } = req.body;

    if (!playerId || !tournamentId || !match) {
        return res.status(400).json({ error: 'playerId, tournamentId und match sind erforderlich' });
    }

    // Acquire lock to prevent race conditions
    const releaseLock = await acquireMatchLock();

    try {
        // Lade aktuelle Results
        const row = await db.get("SELECT value FROM storage WHERE key = ?", ['tm_results']);
        let results = row ? JSON.parse(row.value) : [];

        // Finde oder erstelle Player Result Entry
        let playerResultIdx = results.findIndex(r => r.playerId === playerId && r.tournamentId === tournamentId);

        if (playerResultIdx >= 0) {
            // --- CONCURRENCY CHECK: Prüfe ob dieses Match bereits existiert ---
            // Ein Match ist eindeutig durch: roundId + opponentId
            const existingMatch = results[playerResultIdx].matches.find(m =>
                m.roundId === match.roundId && m.opponentId === match.opponentId
            );

            // Prüfe ob das existierende Match bereits ein "echtes" Ergebnis hat
            const hasRealScore = (m) => {
                if (!m || !m.score) return false;
                const s = m.score.trim();
                // Ignoriere Platzhalter wie "", "0:0", "0:0 0:0"
                return s !== "" && s !== "0:0" && s !== "0:0 0:0";
            };

            // HINWEIS: Keine Konflikt-Erkennung mehr - immer den neuesten Score akzeptieren
            // Bei gleichem roundId+opponentId wird das existierende Match einfach überschrieben
            if (existingMatch && hasRealScore(existingMatch)) {
                console.log(`📝 Update erkannt: ${match.roundId} vs ${match.opponentId}, alter Score: ${existingMatch.score}, neuer Score: ${match.score}`);
            }

            // STRICT MATCH IDENTIFICATION - NO AMBIGUOUS FALLBACKS
            // Only use unique identifiers to prevent updating wrong matches

            let targetIdx = -1;

            // 1. PRIORITY: fixtureId (eindeutigster Identifier - MUSS verwendet werden)
            if (match.fixtureId) {
                targetIdx = results[playerResultIdx].matches.findIndex(m => m.fixtureId === match.fixtureId);
                if (targetIdx >= 0) {
                    console.log(`✅ Match gefunden via fixtureId: ${match.fixtureId}`);
                }
            }

            // 2. Fallback: match.id (für bestehende Matches ohne fixtureId)
            if (targetIdx < 0 && match.id) {
                targetIdx = results[playerResultIdx].matches.findIndex(m => m.id === match.id);
                if (targetIdx >= 0) {
                    console.log(`✅ Match gefunden via match.id: ${match.id}`);
                }
            }

            // WICHTIG: KEIN Fallback auf roundId+opponentId mehr!
            // Dies verhindert, dass mehrere Matches mit der gleichen Spielerpaarung überschrieben werden.
            // Wenn kein fixtureId/match.id Match gefunden wird, wird ein NEUES Match erstellt.
            if (targetIdx < 0) {
                console.log(`⚠️ Kein bestehendes Match gefunden mit fixtureId=${match.fixtureId}, id=${match.id} - neues Match wird erstellt`);
            }

            // Update oder Insert
            if (targetIdx >= 0) {
                console.log(`📝 Updating match at index ${targetIdx}`);
                results[playerResultIdx].matches[targetIdx] = match;
            } else {
                console.log(`➕ Adding new match for player ${playerId}`);
                results[playerResultIdx].matches.push(match);
            }
        } else {
            // Neuer Result-Eintrag für diesen Spieler
            const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
            results.push({
                id: generateId(),
                playerId,
                tournamentId,
                matches: [match]
            });
        }

        // Speichere zurück
        await db.run(`INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)`, ['tm_results', JSON.stringify(results)]);
        res.json({ success: true, resultsCount: results.length });
    } catch (err) {
        console.error("Fehler beim atomaren Match-Speichern:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        // Always release the lock
        releaseLock();
    }
});

// Atomares Match löschen
app.delete('/api/results/match', async (req, res) => {
    const { playerId, tournamentId, matchId, roundId, opponentId, fixtureId } = req.body;

    if (!playerId || !tournamentId) {
        return res.status(400).json({ error: 'playerId und tournamentId sind erforderlich' });
    }

    // Acquire lock to prevent race conditions
    const releaseLock = await acquireMatchLock();

    try {
        // Lade aktuelle Results
        const row = await db.get("SELECT value FROM storage WHERE key = ?", ['tm_results']);
        let results = row ? JSON.parse(row.value) : [];

        // Finde Player Result Entry
        const playerResultIdx = results.findIndex(r => r.playerId === playerId && r.tournamentId === tournamentId);

        if (playerResultIdx >= 0) {
            // Lösche Match basierend auf (Priorität):
            // 1. fixtureId (eindeutigster Identifier!)
            // 2. matchId
            // 3. roundId+opponentId (FALLBACK - nur wenn fixtureId nicht vorhanden)
            results[playerResultIdx].matches = results[playerResultIdx].matches.filter(m => {
                // PRIORITÄT 1: fixtureId (eindeutig pro Fixture)
                if (fixtureId && m.fixtureId === fixtureId) {
                    console.log(`🗑️ Lösche Match via fixtureId: ${fixtureId}`);
                    return false;
                }
                // PRIORITÄT 2: matchId
                if (matchId && m.id === matchId) {
                    console.log(`🗑️ Lösche Match via matchId: ${matchId}`);
                    return false;
                }
                // FALLBACK: roundId+opponentId (NUR wenn fixtureId NICHT angegeben wurde!)
                if (!fixtureId && roundId && opponentId && m.roundId === roundId && m.opponentId === opponentId) {
                    console.log(`🗑️ Lösche Match via roundId+opponentId Fallback: ${roundId} vs ${opponentId}`);
                    return false;
                }
                return true;
            });

            // Entferne leeren Result-Eintrag NICHT - Spieler soll erhalten bleiben!
        }

        // Speichere zurück
        await db.run(`INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)`, ['tm_results', JSON.stringify(results)]);
        res.json({ success: true });
    } catch (err) {
        console.error("Fehler beim atomaren Match-Löschen:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        // Always release the lock
        releaseLock();
    }
});

// --- FRONTEND AUSLIEFERN ---
app.use(express.static(path.join(__dirname, '../dist')));

// Serve SPA fallback for any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// SERVER START - erst nach DB-Init
const startServer = async () => {
    await initDB(); // Warte auf Turso-Verbindung
    app.listen(PORT, () => {
        console.log(`🚀 Server läuft auf Port ${PORT} mit Turso Cloud DB`);
    });
};

startServer();