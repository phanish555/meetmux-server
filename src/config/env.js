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
};

if (config.dataSource === 'postgres' && !config.databaseUrl) {
  throw new Error('DATABASE_URL is required when DATA_SOURCE=postgres');
}

const required = ['port'];
for (const key of required) {
  if (!config[key]) {
    throw new Error(`Missing required config value: ${key}`);
  }
}

module.exports = config;
