const axios = require('axios');

const BASE = 'https://api.hubapi.com';

/**
 * URL d'autorisation OAuth HubSpot
 */
function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    scope: 'crm.objects.contacts.read crm.objects.deals.read',
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params}`;
}

/**
 * Échange un code OAuth contre un access token
 */
async function exchangeCode(code) {
  const res = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    code,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.data;
}

/**
 * Récupère les contacts et deals HubSpot
 */
async function fetchData(accessToken) {
  try {
    const h = { Authorization: `Bearer ${accessToken}` };

    const [contactsRes, dealsRes] = await Promise.all([
      axios.get(`${BASE}/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,company`, { headers: h }),
      axios.get(`${BASE}/crm/v3/objects/deals?limit=100&properties=dealname,amount,closedate,dealstage,associations.company`, { headers: h }),
    ]);

    const clients = contactsRes.data.results.map(c => ({
      id: c.id,
      nom: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim(),
      entreprise: c.properties.company,
    }));

    const transactions = dealsRes.data.results
      .filter(d => d.properties.dealstage === 'closedwon')
      .map(d => ({
        clientId: d.id,
        clientNom: d.properties.dealname,
        montant: parseFloat(d.properties.amount) || 0,
        date: d.properties.closedate,
      }));

    return { ok: true, data: { clients, transactions } };
  } catch (err) {
    return { ok: false, error: `Erreur HubSpot : ${err.message}` };
  }
}

module.exports = { getAuthUrl, exchangeCode, fetchData };
