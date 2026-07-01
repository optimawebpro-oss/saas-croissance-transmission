'use strict';

const fs   = require('fs');
const path = require('path');
const { deleteUser: deleteSubscription } = require('./subscriptionDb');
const { deleteUser: deleteUsage }        = require('./usageDb');
const { deleteKindeUser }                = require('./kindeManagement');

const DELETION_REGISTRY = path.join(__dirname, '../../data/deletion_registry.json');
const DOCUMENTS_DIR     = path.join(__dirname, '../../data/documents');

function deleteUserDocuments(userId) {
  const userDir = path.join(DOCUMENTS_DIR, userId);
  if (fs.existsSync(userDir)) {
    fs.rmSync(userDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function logDeletion(entry) {
  let registry = [];
  if (fs.existsSync(DELETION_REGISTRY)) {
    try { registry = JSON.parse(fs.readFileSync(DELETION_REGISTRY, 'utf8')); } catch { registry = []; }
  }
  registry.push(entry);
  fs.mkdirSync(path.dirname(DELETION_REGISTRY), { recursive: true });
  fs.writeFileSync(DELETION_REGISTRY, JSON.stringify(registry, null, 2));
}

async function deleteAccount(userId, userEmail) {
  const anonymousId = `ANON_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const deletedAt   = new Date().toISOString();
  const steps       = {};

  try {
    const result = await deleteKindeUser(userId);
    steps.kinde = { success: true, ...result };
  } catch (err) {
    steps.kinde = { success: false, error: err.message };
  }

  try { deleteSubscription(userId); steps.subscription = { success: true }; }
  catch (err) { steps.subscription = { success: false, error: err.message }; }

  try { deleteUsage(userId); steps.usage = { success: true }; }
  catch (err) { steps.usage = { success: false, error: err.message }; }

  try {
    const had = deleteUserDocuments(userId);
    steps.documents = { success: true, hadFiles: had };
  } catch (err) { steps.documents = { success: false, error: err.message }; }

  logDeletion({
    anonymousId, deletedAt, steps,
    legalRetention: '10 ans (L123-22 Code de commerce)',
  });

  const allSuccess = Object.values(steps).every(s => s.success);
  return {
    success: allSuccess, anonymousId, deletedAt, steps,
    message: allSuccess
      ? 'Compte et données personnelles supprimés. Factures anonymisées conservées 10 ans.'
      : 'Suppression partielle — certaines étapes ont échoué (voir steps).',
  };
}

module.exports = { deleteAccount };
