// Script zum Ändern des Admin-Passworts
const crypto = require('crypto');
const { db } = require('./database');

// === HIER NEUES PASSWORT EINGEBEN ===
const NEW_PASSWORD = 'tennis';  // <-- Ändere das!
// =====================================

async function changePassword() {
  // Passwort hashen (SHA-256)
  const hash = crypto.createHash('sha256').update(NEW_PASSWORD).digest('hex');
  
  console.log('🔐 Ändere Admin-Passwort...\n');
  
  // Hole aktuelle Admins
  const row = await db.get('SELECT value FROM storage WHERE key = ?', ['tm_admins']);
  const admins = JSON.parse(row.value);
  
  // Finde den Admin (erster mit isSuperAdmin oder erster überhaupt)
  const adminIndex = admins.findIndex(a => a.isSuperAdmin) || 0;
  const oldHash = admins[adminIndex].password.substring(0, 8) + '...';
  
  // Setze neues Passwort
  admins[adminIndex].password = hash;
  
  // Speichern
  await db.run('INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)', 
    ['tm_admins', JSON.stringify(admins)]);
  
  console.log(`✅ Passwort für "${admins[adminIndex].username}" geändert!`);
  console.log(`   Alter Hash: ${oldHash}`);
  console.log(`   Neuer Hash: ${hash.substring(0, 8)}...`);
  console.log(`\n🎾 Du kannst dich jetzt mit dem neuen Passwort einloggen.`);
  
  process.exit(0);
}

changePassword();
