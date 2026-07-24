const config = require('../../config/env');
const prisma = require('../prisma');

const THRESHOLD = Number(process.env.QUERY_COUNT_WARN || 10);

let total = 0;
if (config.nodeEnv === 'development') {
  prisma.$on('query', () => { total += 1; });
}

function queryCounter(req, res, next) {
  if (config.nodeEnv !== 'development') return next();
  const start = total;
  res.on('finish', () => {
    const used = total - start;
    if (used > THRESHOLD) {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'High query count — possible N+1',
        path: req.originalUrl,
        method: req.method,
        queries: used,
      }));
    }
  });
  next();
}

module.exports = queryCounter;
