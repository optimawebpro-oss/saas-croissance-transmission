/**
 * Parser FEC (Fichier des Écritures Comptables)
 * Norme DGFiP — Article A.47 A-1 du Livre des Procédures Fiscales
 * 18 colonnes obligatoires, séparateur tabulation (\t) ou pipe (|)
 */

const FEC_REQUIRED_COLUMNS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit',
  'Credit', 'EcritureLet', 'DateLet', 'ValidDate',
  'Montantdevise', 'Idevise',
];

// Comptes de produits (classe 7) et charges (classe 6)
const COMPTE_VENTE = /^7/;
const COMPTE_CHARGE = /^6/;
const COMPTE_EBE = /^(60|61|62|63|64)/; // charges qui entrent dans l'EBE
const COMPTE_AMORT = /^68/;

/**
 * Parse un buffer FEC et retourne les indicateurs financiers clés
 * @param {Buffer} buffer
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
function parseFEC(buffer) {
  const content = buffer.toString('utf8');
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    return { ok: false, error: 'Fichier FEC vide ou trop court.' };
  }

  // Détecter le séparateur
  const separator = lines[0].includes('\t') ? '\t' : '|';
  const headers = lines[0].split(separator).map(h => h.trim());

  // Valider les 18 colonnes obligatoires
  const missingCols = FEC_REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missingCols.length > 0) {
    return {
      ok: false,
      error: `FEC invalide — colonnes manquantes : ${missingCols.join(', ')}.`,
    };
  }

  const idx = {};
  headers.forEach((h, i) => (idx[h] = i));

  const exercices = {}; // { "2023": { ca, charges, ebitda, dotAmort }, ... }
  let totalLines = 0;
  let errorLines = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator);
    if (cols.length < 18) { errorLines++; continue; }

    const compteNum = (cols[idx.CompteNum] || '').trim();
    const dateStr = (cols[idx.EcritureDate] || '').trim(); // YYYYMMDD
    const debit = parseFloat((cols[idx.Debit] || '0').replace(',', '.')) || 0;
    const credit = parseFloat((cols[idx.Credit] || '0').replace(',', '.')) || 0;

    if (!dateStr || dateStr.length < 4) { errorLines++; continue; }
    const annee = dateStr.substring(0, 4);
    if (!exercices[annee]) {
      exercices[annee] = { ca: 0, charges: 0, chargesEbe: 0, dotAmort: 0 };
    }

    // Chiffre d'affaires = comptes 7xx (solde crédit - débit)
    if (COMPTE_VENTE.test(compteNum)) {
      exercices[annee].ca += (credit - debit);
    }

    // Charges = comptes 6xx
    if (COMPTE_CHARGE.test(compteNum)) {
      const montantCharge = debit - credit;
      exercices[annee].charges += montantCharge;

      // Charges entrant dans l'EBE (60-64)
      if (COMPTE_EBE.test(compteNum)) {
        exercices[annee].chargesEbe += montantCharge;
      }

      // Dotations aux amortissements (68)
      if (COMPTE_AMORT.test(compteNum)) {
        exercices[annee].dotAmort += montantCharge;
      }
    }

    totalLines++;
  }

  // Calculer EBE et résultat par exercice
  const resultats = {};
  for (const [annee, data] of Object.entries(exercices)) {
    const ebitda = data.ca - data.chargesEbe;
    const resultat = data.ca - data.charges;
    resultats[annee] = {
      annee: parseInt(annee),
      ca: round(data.ca),
      charges: round(data.charges),
      ebitda: round(ebitda),
      resultat: round(resultat),
      dotationsAmort: round(data.dotAmort),
      margeEbitda: data.ca > 0 ? round((ebitda / data.ca) * 100) : 0,
    };
  }

  const anneesSorted = Object.keys(resultats).sort();
  const dernierExercice = resultats[anneesSorted[anneesSorted.length - 1]];

  return {
    ok: true,
    data: {
      exercices: Object.values(resultats).sort((a, b) => a.annee - b.annee),
      dernierExercice,
      nbExercices: anneesSorted.length,
      qualite: {
        totalLignes: totalLines,
        lignesInvalides: errorLines,
        tauxValidite: totalLines > 0 ? round(((totalLines - errorLines) / totalLines) * 100) : 0,
      },
    },
  };
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = { parseFEC };
