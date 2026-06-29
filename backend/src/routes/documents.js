'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan }  = require('../middleware/requirePlan');

const UPLOAD_DIR = path.join(__dirname, '../../data/documents');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_DIR, req.user.id);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${req.body.type || 'doc'}_${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.csv', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// POST /api/documents/upload
router.post('/upload', requireAuth, requirePlan('croissance'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant ou format non supporté.' });
  res.json({
    success: true,
    message: `${req.file.originalname} importé avec succès.`,
    type: req.body.type,
    size: req.file.size,
  });
});

// GET /api/documents/list
router.get('/list', requireAuth, (req, res) => {
  const userDir = path.join(UPLOAD_DIR, req.user.id);
  if (!fs.existsSync(userDir)) return res.json({ files: [] });
  const files = fs.readdirSync(userDir).map(f => ({ name: f, size: fs.statSync(path.join(userDir, f)).size }));
  res.json({ files });
});

// DELETE /api/documents/:type — supprime les docs d'un type
router.delete('/:type', requireAuth, (req, res) => {
  const userDir = path.join(UPLOAD_DIR, req.user.id);
  if (!fs.existsSync(userDir)) return res.json({ success: true });
  const files = fs.readdirSync(userDir).filter(f => f.startsWith(req.params.type + '_'));
  files.forEach(f => fs.unlinkSync(path.join(userDir, f)));
  res.json({ success: true, deleted: files.length });
});

module.exports = router;
