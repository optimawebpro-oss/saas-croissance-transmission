const { createLogger, format, transports } = require('winston');
const path = require('path');

// Logger Winston — fichier rotatif + console
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: path.join(__dirname, '../../logs/audit.log') }),
    new transports.Console({ format: format.simple() }),
  ],
});

// Routes qui accèdent à des données sensibles
const SENSITIVE_ROUTES = ['/api/fec', '/api/banking', '/api/crm', '/api/sirh', '/api/juridique', '/api/rgpd'];

/**
 * Middleware d'audit — log chaque accès aux données sensibles
 * Conformité RGPD : art. 32 (sécurité du traitement)
 */
function auditLog(req, res, next) {
  const isSensitive = SENSITIVE_ROUTES.some(r => req.path.startsWith(r));
  if (!isSensitive) return next();

  const entry = {
    event: 'DATA_ACCESS',
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.headers['x-user-id'] || 'anonymous',
    entrepriseId: req.headers['x-entreprise-id'] || null,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  };

  logger.info(entry);
  next();
}

module.exports = { auditLog, logger };
