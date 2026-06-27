const axios = require('axios');

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.PIPEDRIVE_CLIENT_ID,
    redirect_uri: process.env.PIPEDRIVE_REDIRECT_URI,
    state,
  });
  return `https://oauth.pipedrive.com/oauth/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await axios.post('https://oauth.pipedrive.com/oauth/token', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.PIPEDRIVE_REDIRECT_URI,
  }), {
    auth: { username: process.env.PIPEDRIVE_CLIENT_ID, password: process.env.PIPEDRIVE_CLIENT_SECRET },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

async function fetchData(accessToken) {
  try {
    const h = { Authorization: `Bearer ${accessToken}` };
    const base = 'https://api.pipedrive.com/v1';

    const [personsRes, dealsRes] = await Promise.all([
      axios.get(`${base}/persons?limit=100`, { headers: h }),
      axios.get(`${base}/deals?status=won&limit=100`, { headers: h }),
    ]);

    const clients = (personsRes.data.data || []).map(p => ({
      id: p.id,
      nom: p.name,
      entreprise: p.org_name,
    }));

    const transactions = (dealsRes.data.data || []).map(d => ({
      clientId: String(d.person_id?.value || d.id),
      clientNom: d.person_name || d.title,
      montant: d.value || 0,
      date: d.won_time || d.close_time,
    }));

    return { ok: true, data: { clients, transactions } };
  } catch (err) {
    return { ok: false, error: `Erreur Pipedrive : ${err.message}` };
  }
}

module.exports = { getAuthUrl, exchangeCode, fetchData };
