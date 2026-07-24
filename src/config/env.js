const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'PlaceMux API',
  dataSource: process.env.DATA_SOURCE || 'mock',
  databaseUrl: process.env.DATABASE_URL || '',
  db: {
    poolSize: Number(process.env.DB_POOL_SIZE || 10),
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT || 20),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10),
    slowQueryMs: Number(process.env.DB_SLOW_QUERY_MS || 100),
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    passwordPepper: process.env.PASSWORD_PEPPER || '',
    issuer: process.env.JWT_ISSUER || 'placemux-api',
    audience: process.env.JWT_AUDIENCE || 'placemux-web',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

if (config.dataSource === 'postgres' && !config.databaseUrl) {
  throw new Error('DATABASE_URL is required when DATA_SOURCE=postgres');
}

// Auth secrets — fail fast so we never boot into an insecure state
const AUTH_KEYS = ['accessSecret', 'refreshSecret', 'passwordPepper'];
const REQUIRE_AUTH = config.nodeEnv !== 'test' || config.auth.accessSecret;
if (REQUIRE_AUTH) {
  for (const key of AUTH_KEYS) {
    if (!config.auth[key] || config.auth[key].length < 32) {
      throw new Error(`Config error: auth.${key} is missing or too short (need ≥32 chars). Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`);
    }
  }
  if (config.auth.accessSecret === config.auth.refreshSecret) {
    throw new Error('Config error: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
}

module.exports = config;
