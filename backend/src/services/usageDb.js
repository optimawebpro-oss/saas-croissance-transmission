const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/usage.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Nombre de diagnostics IA déjà consommés par l'utilisateur (plan gratuit)
function getFreeDiagnosticsUsed(userId) {
  const db = readDb();
  return db[userId]?.freeDiagnosticsUsed || 0;
}

function incrementFreeDiagnostics(userId) {
  const db = readDb();
  db[userId] = { ...db[userId], freeDiagnosticsUsed: (db[userId]?.freeDiagnosticsUsed || 0) + 1, updatedAt: new Date().toISOString() };
  writeDb(db);
}

function deleteUser(userId) {
  const db = readDb();
  delete db[userId];
  writeDb(db);
}

module.exports = { getFreeDiagnosticsUsed, incrementFreeDiagnostics, deleteUser };
