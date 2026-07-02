'use strict';

const path = require('path');
const fs   = require('fs');

// En local : data/ et logs/ relatifs à backend/
// Sur Clever Cloud : PERSISTENT_DIR pointe vers le FS Bucket monté
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname, '../..');

const DATA_DIR = path.join(PERSISTENT_DIR, 'data');
const LOGS_DIR = path.join(PERSISTENT_DIR, 'logs');

// Créer les dossiers au démarrage s'ils n'existent pas
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

module.exports = { DATA_DIR, LOGS_DIR };
