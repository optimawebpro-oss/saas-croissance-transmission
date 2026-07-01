'use strict';

const cron       = require('node-cron');
const nodemailer = require('nodemailer');
const fs         = require('fs');
const { runPurge, PURGE_LOG } = require('./purge');

// ── Mailer ────────────────────────────────────────────────

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_SECURE === 'true',
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildEmailHtml(weeklySummaries) {
  const total_deleted = weeklySummaries.reduce((s, r) => s + (r.totals?.deleted || 0), 0);
  const total_errors  = weeklySummaries.reduce((s, r) => s + (r.totals?.errors  || 0), 0);
  const runs          = weeklySummaries.length;

  const runsHtml = weeklySummaries.map(r => {
    const { r1, r2, r3, r4 } = r.rules || {};
    return `
      <tr>
        <td style="padding:6px 12px;color:#7a7a9a;font-size:12px;">${r.startedAt?.slice(0,10) || '—'}</td>
        <td style="padding:6px 12px;text-align:center;">${r1?.deleted ?? 0}</td>
        <td style="padding:6px 12px;text-align:center;">${r2?.deleted ?? 0}</td>
        <td style="padding:6px 12px;text-align:center;">${r3?.deleted ?? 0}</td>
        <td style="padding:6px 12px;text-align:center;">${r4?.deleted ?? 0}</td>
        <td style="padding:6px 12px;text-align:center;color:${r.totals?.errors ? '#f87171' : '#34d399'};">${r.totals?.errors ?? 0}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#08080f;color:#f0f0f8;padding:32px;max-width:680px;margin:0 auto;">
  <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Apogée — Rapport de purge RGPD</h1>
  <p style="color:#7a7a9a;font-size:13px;margin-bottom:28px;">Semaine du ${new Date(Date.now() - 7*24*60*60*1000).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}</p>

  <div style="display:flex;gap:16px;margin-bottom:28px;">
    <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#4e89e8;">${runs}</div>
      <div style="font-size:12px;color:#7a7a9a;margin-top:4px;">Purges exécutées</div>
    </div>
    <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#34d399;">${total_deleted}</div>
      <div style="font-size:12px;color:#7a7a9a;margin-top:4px;">Éléments supprimés</div>
    </div>
    <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:${total_errors > 0 ? '#f87171' : '#34d399'};">${total_errors}</div>
      <div style="font-size:12px;color:#7a7a9a;margin-top:4px;">Erreurs</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden;font-size:13px;">
    <thead>
      <tr style="background:rgba(255,255,255,0.06);">
        <th style="padding:8px 12px;text-align:left;color:#7a7a9a;font-weight:500;">Date</th>
        <th style="padding:8px 12px;color:#7a7a9a;font-weight:500;">R1 Docs</th>
        <th style="padding:8px 12px;color:#7a7a9a;font-weight:500;">R2 Prospects</th>
        <th style="padding:8px 12px;color:#7a7a9a;font-weight:500;">R3 Comptes</th>
        <th style="padding:8px 12px;color:#7a7a9a;font-weight:500;">R4 Logs</th>
        <th style="padding:8px 12px;color:#7a7a9a;font-weight:500;">Erreurs</th>
      </tr>
    </thead>
    <tbody>${runsHtml}</tbody>
  </table>

  <div style="margin-top:24px;padding:14px 18px;background:rgba(78,137,232,0.06);border:1px solid rgba(78,137,232,0.15);border-radius:8px;font-size:12px;color:#7a7a9a;">
    <strong style="color:#f0f0f8;">Règles appliquées :</strong><br/>
    R1 — Documents &amp; IA : suppression 30j après fin de mission<br/>
    R2 — Prospects : suppression 3 ans après dernier contact<br/>
    R3 — Comptes clôturés : suppression complète 30j après clôture<br/>
    R4 — Logs de connexion : suppression après 12 mois<br/>
    <span style="color:#4e89e8;">Factures : conservées 10 ans (obligation légale — non purgées)</span>
  </div>

  <p style="margin-top:24px;font-size:11px;color:#4a4a6a;">Ce rapport est généré automatiquement par le système de conformité RGPD d'Apogée.</p>
</body></html>`;
}

async function sendWeeklyReport(summaries) {
  const to = process.env.RGPD_REPORT_EMAIL || process.env.SMTP_USER;
  if (!to) {
    console.warn('[Purge] RGPD_REPORT_EMAIL non configuré — email non envoyé.');
    return;
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Purge] SMTP non configuré — email non envoyé.');
    return;
  }

  try {
    await transporter.sendMail({
      from:    `"Apogée RGPD" <${process.env.SMTP_USER}>`,
      to,
      subject: `[Apogée] Rapport de purge RGPD — semaine du ${new Date().toLocaleDateString('fr-FR')}`,
      html:    buildEmailHtml(summaries),
    });
    console.log(`[Purge] Rapport hebdomadaire envoyé à ${to}`);
  } catch (err) {
    console.error('[Purge] Échec envoi email :', err.message);
  }
}

// ── Accumulation des résultats hebdomadaires ──────────────

let weeklySummaries = [];

// ── Démarrage des crons ───────────────────────────────────

function startPurgeScheduler() {
  // Purge quotidienne à 02h00
  cron.schedule('0 2 * * *', async () => {
    console.log('[Purge] Démarrage purge quotidienne RGPD…');
    try {
      const summary = await runPurge();
      weeklySummaries.push(summary);
      console.log(`[Purge] Terminée — ${summary.totals.deleted} élément(s) supprimé(s), ${summary.totals.errors} erreur(s).`);
    } catch (err) {
      console.error('[Purge] Erreur critique :', err.message);
    }
  }, { timezone: 'Europe/Paris' });

  // Rapport hebdomadaire le lundi à 08h00
  cron.schedule('0 8 * * 1', async () => {
    console.log('[Purge] Envoi du rapport hebdomadaire RGPD…');
    await sendWeeklyReport(weeklySummaries);
    weeklySummaries = []; // Réinitialise pour la semaine suivante
  }, { timezone: 'Europe/Paris' });

  console.log('✦ Scheduler de purge RGPD démarré (purge 02h00 quotidien · rapport lundi 08h00)');
}

module.exports = { startPurgeScheduler, runPurge };
