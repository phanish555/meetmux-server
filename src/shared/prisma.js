const { PrismaClient } = require('@prisma/client');
const config = require('../config/env');

function buildDatasourceUrl() {
  if (!config.databaseUrl) return undefined;
  const url = new URL(config.databaseUrl);
  url.searchParams.set('connection_limit', String(config.db.poolSize));
  url.searchParams.set('pool_timeout', String(config.db.poolTimeout));
  url.searchParams.set('connect_timeout', String(config.db.connectTimeout));
  return url.toString();
}

const datasourceUrl = buildDatasourceUrl();

const prisma = new PrismaClient({
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  log:
    config.nodeEnv === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['error'],
});

if (config.nodeEnv === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > config.db.slowQueryMs) {
      console.warn(JSON.stringify({
        level: 'warn',
        slowQuery: e.query,
        params: e.params,
        durationMs: e.duration,
      }));
    }
  });
}

module.exports = prisma;
