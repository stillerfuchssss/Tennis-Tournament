# Tennis Manager - Deployment Anleitung für MC-Host24

## Dateien hochladen

1. Laden Sie alle Dateien aus diesem Ordner auf Ihren Webspace hoch
2. Die Struktur sollte sein:
   ```
   /
   ├── index.html
   ├── assets/
   │   ├── index-*.css
   │   └── index-*.js
   ├── .htaccess
   ├── index.js (Server)
   ├── database.js (Server)
   └── package.json (Server)
   ```

## Node.js konfigurieren (MC-Host24)

1. **Im MC-Host24 Control Panel:**
   - Gehen Sie zu "Node.js Anwendungen"
   - Erstellen Sie eine neue Node.js Anwendung
   - **Node.js Version:** 18.x oder höher
   - **Startdatei:** `index.js`
   - **Port:** Wird automatisch zugewiesen (MC-Host24 setzt PORT Environment Variable)

2. **Dependencies installieren:**
   - Im Control Panel unter "Node.js" → "Terminal" oder via SSH:
   ```bash
   npm install
   ```

3. **Umgebungsvariablen setzen:**
   Im Control Panel unter "Node.js" → "Umgebungsvariablen":
   - `NODE_ENV=production`
   - Optional: `TURSO_DB_URL` und `TURSO_AUTH_TOKEN` (wenn Sie Turso verwenden möchten)

4. **Anwendung starten:**
   - Die Anwendung sollte automatisch starten
   - Falls nicht, im Terminal: `npm start`

## Turso Datenbank (optional, empfohlen)

Aktuell verwendet die App localStorage im Browser. Für eine echte Datenbank:

1. Kostenloses Konto bei [Turso](https://turso.tech) erstellen
2. Datenbank erstellen:
   ```bash
   turso db create tennis-manager
   turso db show tennis-manager
   ```
3. Auth Token holen:
   ```bash
   turso db tokens create tennis-manager
   ```
4. URL und Token als Umgebungsvariablen in MC-Host24 setzen

## Ohne Turso (nur localStorage)

Die App funktioniert auch ohne Server-Datenbank. Die Daten werden dann nur im Browser gespeichert.
In diesem Fall wird der Node.js-Server nur zum Ausliefern der statischen Dateien verwendet.

## Zugriff

Nach dem Deployment ist die App unter Ihrer Domain erreichbar:
- https://ihre-domain.de

## Erste Schritte

1. Admin-Account erstellen über "Registrieren"
2. Ersten Admin genehmigen (Status wird in localStorage gespeichert)
3. Spieler hinzufügen und Turniere erstellen

## Support

Bei Problemen mit MC-Host24:
- Node.js Version prüfen (min. 18.x)
- Logs im Control Panel überprüfen
- Ports und Firewall-Einstellungen kontrollieren
