'use strict';

const fs   = require('fs');
const path = require('path');

const { DATA_DIR, LOGS_DIR } = require('../config/storage');
const PROFILES_PATH    = path.join(DATA_DIR, 'profiles.json');
const PROFILE_AUDIT    = path.join(LOGS_DIR, 'profile_audit.log');

// ── CRUD profil ───────────────────────────────────────────

function readProfiles() {
  if (!fs.existsSync(PROFILES_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')); } catch { return {}; }
}

function writeProfiles(data) {
  fs.mkdirSync(path.dirname(PROFILES_PATH), { recursive: true });
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getProfile(userId) {
  return readProfiles()[userId] || null;
}

// Fusionne les champs locaux avec les données JWT (source de vérité pour nom/email)
function mergeWithJwt(userId, jwtPayload) {
  const local = getProfile(userId) || {};
  return {
    given_name:  local.given_name  ?? jwtPayload.given_name  ?? null,
    family_name: local.family_name ?? jwtPayload.family_name ?? null,
    email:       local.email       ?? jwtPayload.email        ?? null,
    telephone:   local.telephone   ?? null,
    entreprise:  local.entreprise  ?? null,
    poste:       local.poste       ?? null,
    updatedAt:   local.updatedAt   ?? null,
  };
}

// Champs autorisés à être modifiés localement
const LOCAL_FIELDS = ['telephone', 'entreprise', 'poste'];
// Champs synchronisés avec Kinde (stockés aussi localement comme cache)
const KINDE_FIELDS = ['given_name', 'family_name', 'email'];
const ALL_FIELDS   = [...KINDE_FIELDS, ...LOCAL_FIELDS];

function updateProfile(userId, updates) {
  const profiles = readProfiles();
  const current  = profiles[userId] || {};
  const now      = new Date().toISOString();

  // N'accepter que les champs connus
  const sanitized = {};
  for (const field of ALL_FIELDS) {
    if (updates[field] !== undefined) sanitized[field] = String(updates[field]).trim();
  }

  profiles[userId] = { ...current, ...sanitized, updatedAt: now };
  writeProfiles(profiles);
  return profiles[userId];
}

// ── Audit trail ───────────────────────────────────────────

function logProfileChange(userId, changes, ip) {
  const entries = changes.map(({ field, oldValue, newValue }) => ({
    event:    'PROFILE_UPDATED',
    userId,
    field,
    oldValue: field === 'email' ? maskEmail(oldValue) : oldValue,
    newValue: field === 'email' ? maskEmail(newValue) : newValue,
    ip:       ip || null,
    timestamp: new Date().toISOString(),
  }));

  fs.mkdirSync(path.dirname(PROFILE_AUDIT), { recursive: true });
  const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(PROFILE_AUDIT, lines, 'utf8');
  return entries;
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

module.exports = { getProfile, mergeWithJwt, updateProfile, logProfileChange, LOCAL_FIELDS, KINDE_FIELDS, ALL_FIELDS };
