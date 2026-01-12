# Turso-Datenbank bereits eingerichtet! 🎉

## Ihre Turso-Datenbank

**Database URL:** `libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io`
**Region:** AWS US-East-2

Die Datenbank ist bereits erstellt und einsatzbereit!

## Deployment mit Turso

### Option 1: Mit den bestehenden Credentials (empfohlen)

Die Credentials sind bereits im Code hinterlegt. Beim Deployment auf MC-Host24:

1. **Dateien hochladen** (wie in MC-HOST24-ANLEITUNG.md beschrieben)

2. **Im Terminal ausführen:**
   ```bash
   npm install
   ```

3. **Fertig!** Der Server verbindet sich automatisch mit Ihrer Turso-Datenbank.

Die Datenbank wird automatisch initialisiert beim ersten Start.

### Option 2: Mit Umgebungsvariablen (sicherer für Produktion)

Für mehr Sicherheit können Sie die Credentials als Umgebungsvariablen in MC-Host24 setzen:

**Im MC-Host24 Control Panel → Umgebungsvariablen:**

```
TURSO_DATABASE_URL=libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQ3MTI3MzMsImlkIjoiNWNmMTliZmEtMTZjYS00NGI5LWI4ZmItMmFhMDQ1ZGRjYmI0IiwicmlkIjoiMjc4ZTJkODItYWQ1MC00OTlkLWFiMjctYjgxZmI5OTAxNDY0In0.8flxkNvAFnlGwE5KwSMRu47zw7KwODJO7X8HYr5gLMMo78s7jAzGNGLnN7K_tVhElJQA_Yr7PgXxlI3xMB0TDw
NODE_ENV=production
```

**Dann im Code:** Credentials aus den Umgebungsvariablen werden automatisch verwendet (Fallback auf hardcoded values).

## Vorteile der Turso-Datenbank

✅ **Zentrale Datenspeicherung** - Alle Daten werden in der Cloud gespeichert
✅ **Mehrbenutzerfähig** - Mehrere Browser können gleichzeitig arbeiten
✅ **Datensicherheit** - Automatische Backups durch Turso
✅ **Schnell** - SQLite-Performance mit Cloud-Vorteilen
✅ **Kostenlos** - Bis 500 MB und 1 Milliarde Rows

## Datenbank-Schema

Die App erstellt automatisch diese Tabelle:

```sql
CREATE TABLE storage (
  key TEXT PRIMARY KEY,
  value TEXT
)
```

Gespeicherte Keys:
- `tm_players` - Alle Spieler
- `tm_tournaments` - Alle Turniere
- `tm_results` - Alle Spielergebnisse
- `tm_brackets` - KO-Turniere
- `tm_planner` - Spielplan-Fixtures
- `tm_registrations` - Anmeldungen
- `tm_users` - Benutzer/Admins
- `tm_passwords` - Passwörter (gehashed)
- `tm_permissions` - Berechtigungen

## Migration von localStorage zu Turso

Falls Sie bereits Daten in localStorage haben:

1. Öffnen Sie die App im Browser (alte Version mit localStorage)
2. Drücken Sie F12 → Console
3. Führen Sie aus:
   ```javascript
   // Alle Daten exportieren
   const data = {};
   for (let i = 0; i < localStorage.length; i++) {
     const key = localStorage.key(i);
     if (key.startsWith('tm_')) {
       data[key] = localStorage.getItem(key);
     }
   }
   console.log(JSON.stringify(data));
   // Kopieren Sie die Ausgabe
   ```

4. Daten in neue Version importieren (wenn Server läuft):
   ```javascript
   // In der neuen Version (mit Turso)
   const data = {/* Ihre kopierten Daten */};
   for (const [key, value] of Object.entries(data)) {
     await fetch('/api/storage', {
       method: 'POST',
       headers: {'Content-Type': 'application/json'},
       body: JSON.stringify({key, value: JSON.parse(value)})
     });
   }
   ```

## Turso Dashboard

Sie können Ihre Datenbank verwalten auf:
- https://turso.tech/app

Dort können Sie:
- SQL-Queries ausführen
- Daten exportieren
- Backups erstellen
- Statistiken sehen

## Support

- **Turso Docs:** https://docs.turso.tech
- **Turso Discord:** https://discord.gg/turso
