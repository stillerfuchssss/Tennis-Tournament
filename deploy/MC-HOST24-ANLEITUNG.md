# MC-Host24 Deployment - Kurzanleitung

## Node.js Version
✅ Node.js 21.7.3 (bereits installiert bei MC-Host24)

## Upload-Anleitung

### 1. Alle Dateien aus dem `deploy/` Ordner hochladen

Per FTP/SFTP auf Ihren Webspace:
- `index.html`
- `assets/` (kompletter Ordner)
- `.htaccess`
- `index.js`
- `database.js`
- `package.json`
- `DEPLOYMENT.md`

### 2. Im MC-Host24 Control Panel

**Node.js App erstellen:**
1. Gehe zu "Node.js Anwendungen"
2. "Neue Anwendung erstellen"
3. Einstellungen:
   - **Node.js Version:** 21.7.3 (bereits vorhanden)
   - **Anwendungsordner:** Ihr Webspace-Root oder Unterordner
   - **Startdatei:** `index.js`
   - **Port:** (wird automatisch von MC-Host24 gesetzt via `process.env.PORT`)

**Dependencies installieren:**
1. Im Control Panel → "Terminal" öffnen
2. Befehl ausführen:
   ```bash
   npm install
   ```

**✅ Turso-Datenbank ist bereits konfiguriert!**

Die Credentials sind im Code hinterlegt. Die App verbindet sich automatisch mit Ihrer Turso Cloud-Datenbank.

**Umgebungsvariablen (optional, für mehr Sicherheit):**
Falls Sie die Credentials aus dem Code entfernen möchten, setzen Sie:
- `TURSO_DATABASE_URL` = libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io
- `TURSO_AUTH_TOKEN` = (siehe TURSO-INFO.md)
- `NODE_ENV` = production

Siehe `TURSO-INFO.md` für Details zur Datenbank.

### 3. Anwendung starten

Im Control Panel:
- Anwendung sollte automatisch starten
- Falls nicht: "Neu starten" Button klicken

### 4. Zugriff

Ihre App ist nun erreichbar unter:
- https://ihre-domain.de

## Wichtige Hinweise

### Port-Konfiguration
Der Server verwendet automatisch den Port, den MC-Host24 bereitstellt:
```javascript
const PORT = process.env.PORT || 3000;
```

### Statische Dateien
Alle Frontend-Dateien (HTML, CSS, JS) werden vom Node.js Server ausgeliefert.

### API-Endpunkte
- `GET /api/storage/:key` - Daten laden
- `POST /api/storage` - Daten speichern

### ✅ Turso Cloud-Datenbank

**Ihre App ist bereits mit Turso verbunden!**

Die Datenbank wird automatisch beim ersten Start initialisiert:
- **URL:** libsql://tennis-manager-stillerfuchssss.aws-us-east-2.turso.io
- **Region:** AWS US-East-2
- **Speicher:** Kostenlos bis 500 MB

Alle Daten (Spieler, Turniere, Ergebnisse) werden zentral in der Cloud gespeichert.

Details siehe: `TURSO-INFO.md`

## Troubleshooting

**Anwendung startet nicht:**
- Prüfen Sie die Logs im MC-Host24 Control Panel
- Stellen Sie sicher, dass `npm install` erfolgreich war
- Überprüfen Sie die Dateirechte (644 für Dateien, 755 für Ordner)

**Seite lädt nicht:**
- Prüfen Sie ob der Node.js Prozess läuft
- Überprüfen Sie die Port-Konfiguration
- Checken Sie die .htaccess Einstellungen

**API funktioniert nicht:**
- Prüfen Sie die Browser-Konsole auf Fehler
- Ohne Turso-Setup: API-Calls werden ignoriert, localStorage wird verwendet

## Kontakt

Bei Fragen zum Hosting: MC-Host24 Support
Bei Fragen zur App: Siehe Projekt-Repository
