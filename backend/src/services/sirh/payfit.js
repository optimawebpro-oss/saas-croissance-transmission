const axios = require('axios');

const BASE = 'https://api.payfit.com';

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.PAYFIT_CLIENT_ID,
    redirect_uri: process.env.PAYFIT_REDIRECT_URI,
    response_type: 'code',
    scope: 'employees:read contracts:read',
    state,
  });
  return `${BASE}/auth/oauth/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await axios.post(`${BASE}/auth/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: process.env.PAYFIT_CLIENT_ID,
    client_secret: process.env.PAYFIT_CLIENT_SECRET,
    redirect_uri: process.env.PAYFIT_REDIRECT_URI,
    code,
  });
  return res.data;
}

async function fetchData(accessToken) {
  try {
    const h = { Authorization: `Bearer ${accessToken}` };

    const [empRes, depsRes] = await Promise.all([
      axios.get(`${BASE}/v1/employees`, { headers: h }),
      axios.get(`${BASE}/v1/departures`, { headers: h }),
    ]);

    const employes = (empRes.data.employees || []).map(e => ({
      id: e.id,
      nom: `${e.firstName} ${e.lastName}`,
      dateEntree: e.startDate,
      poste: e.jobTitle,
    }));

    const postes = [...new Set(employes.map(e => e.poste))].map(intitule => ({
      intitule,
      categorie: categorizePoste(intitule),
      niveau: detectNiveau(intitule),
    }));

    const departs = (depsRes.data.departures || []).map(d => ({ date: d.date }));

    return { ok: true, data: { employes, postes, departs } };
  } catch (err) {
    return { ok: false, error: `Erreur PayFit : ${err.message}` };
  }
}

function categorizePoste(intitule) {
  if (/direction|DG|CEO|PDG/i.test(intitule)) return 'direction';
  if (/commercial|vente|sales/i.test(intitule)) return 'commercial';
  if (/technique|dev|ingénieur|IT/i.test(intitule)) return 'technique';
  if (/admin|RH|comptable|finance/i.test(intitule)) return 'support';
  return 'autre';
}

function detectNiveau(intitule) {
  if (/directeur|DAF|DRH|DSI|DG|manager|responsable/i.test(intitule)) return 'N-1';
  return 'collaborateur';
}

module.exports = { getAuthUrl, exchangeCode, fetchData };
