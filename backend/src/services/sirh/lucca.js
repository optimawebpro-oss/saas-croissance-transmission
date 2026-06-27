const axios = require('axios');

// Lucca utilise un sous-domaine client : https://{domaine}.ilucca.net
function buildBase(domain) { return `https://${domain}.ilucca.net/api/v3`; }

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.LUCCA_CLIENT_ID,
    redirect_uri: process.env.LUCCA_REDIRECT_URI,
    response_type: 'code',
    scope: 'users.read leaves.read',
    state,
  });
  return `https://oauth.lucca.fr/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await axios.post('https://oauth.lucca.fr/token', new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.LUCCA_CLIENT_ID,
    client_secret: process.env.LUCCA_CLIENT_SECRET,
    redirect_uri: process.env.LUCCA_REDIRECT_URI,
    code,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.data;
}

async function fetchData(accessToken, domain = 'demo') {
  try {
    const h = { Authorization: `Bearer ${accessToken}` };
    const base = buildBase(domain);

    const usersRes = await axios.get(`${base}/users?fields=id,firstName,lastName,dtContractStart,jobTitle,legalEntityId`, { headers: h });
    const users = usersRes.data.data?.items || [];

    const employes = users.map(u => ({
      id: u.id,
      nom: `${u.firstName} ${u.lastName}`,
      dateEntree: u.dtContractStart,
      poste: u.jobTitle || 'Non renseigné',
    }));

    const postes = [...new Set(employes.map(e => e.poste))].map(intitule => ({
      intitule,
      categorie: /direction|manager|responsable/i.test(intitule) ? 'direction' : 'collaborateur',
      niveau: /directeur|manager|responsable/i.test(intitule) ? 'N-1' : 'collaborateur',
    }));

    return { ok: true, data: { employes, postes, departs: [] } };
  } catch (err) {
    return { ok: false, error: `Erreur Lucca : ${err.message}` };
  }
}

module.exports = { getAuthUrl, exchangeCode, fetchData };
