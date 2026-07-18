const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'PlaceMux API',
};

const required = ['port'];
for (const key of required) {
  if (!config[key]) {
    throw new Error(`Missing required config value: ${key}`);
  }
}

module.exports = config;
