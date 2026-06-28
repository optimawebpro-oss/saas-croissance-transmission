const router = require('express').Router();
const multer = require('multer');
const { parseFEC } = require('../services/fecParser');

const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// Multer : mémoire uniquement, max 50Mo, .txt/.csv uniquement
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(txt|csv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Format invalide — le fichier FEC doit être en .txt ou .csv'));
    }
  },
});

// POST /api/fec/upload
router.post('/upload', requireAuth, requirePlan('croissance'), upload.single('fec'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const result = parseFEC(req.file.buffer);

    if (!result.ok) {
      return res.status(422).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
      message: `FEC analysé : ${result.data.nbExercices} exercice(s) trouvé(s).`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
