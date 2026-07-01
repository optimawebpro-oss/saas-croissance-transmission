'use strict';

/**
 * kindeManagement.js — Appels à la Kinde Management API (M2M)
 * Réutilisé par accountDeletion.js et profil.js
 */

const https = require('https');

async function getM2MToken() {
  const { KINDE_DOMAIN, KINDE_M2M_CLIENT_ID, KINDE_M2M_CLIENT_SECRET } = process.env;
  if (!KINDE_M2M_CLIENT_ID || !KINDE_M2M_CLIENT_SECRET) {
    throw new Error('Variables KINDE_M2M_CLIENT_ID / KINDE_M2M_CLIENT_SECRET manquantes.');
  }

  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     KINDE_M2M_CLIENT_ID,
      client_secret: KINDE_M2M_CLIENT_SECRET,
      audience:      `${process.env.KINDE_DOMAIN}/api`,
    }).toString();

    const u = new URL(`${process.env.KINDE_DOMAIN}/oauth2/token`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (!json.access_token) return reject(new Error('Kinde M2M token manquant : ' + raw));
          resolve(json.access_token);
        } catch { reject(new Error('Réponse Kinde invalide : ' + raw)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function kindeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${process.env.KINDE_DOMAIN}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    };
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function deleteKindeUser(kindeUserId) {
  const token = await getM2MToken();
  const res = await kindeRequest('DELETE', `/api/v1/user?id=${encodeURIComponent(kindeUserId)}`, null, token);
  if (res.status >= 200 && res.status < 300 || res.status === 404) return { kindeStatus: res.status };
  throw new Error(`Kinde DELETE user échoué (${res.status}) : ${JSON.stringify(res.body)}`);
}

async function updateKindeUser(kindeUserId, { given_name, family_name, email }) {
  const token = await getM2MToken();

  // Mise à jour nom/prénom
  if (given_name !== undefined || family_name !== undefined) {
    const r = await kindeRequest('PATCH', `/api/v1/user?id=${encodeURIComponent(kindeUserId)}`, {
      given_name, family_name,
    }, token);
    if (r.status >= 400) throw new Error(`Kinde PATCH user échoué (${r.status}) : ${JSON.stringify(r.body)}`);
  }

  // Mise à jour email (endpoint séparé dans Kinde)
  if (email !== undefined) {
    const r = await kindeRequest('POST', `/api/v1/user/${encodeURIComponent(kindeUserId)}/identities`, {
      type: 'email', details: { email },
    }, token);
    // 200/201 = ajout OK, 409 = email déjà utilisé
    if (r.status === 409) throw new Error('Cet email est déjà associé à un autre compte.');
    if (r.status >= 400) throw new Error(`Kinde email update échoué (${r.status}) : ${JSON.stringify(r.body)}`);
  }

  return { ok: true };
}

module.exports = { getM2MToken, deleteKindeUser, updateKindeUser };
