const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const requestLogger = require('./shared/middleware/requestLogger');
const queryCounter = require('./shared/middleware/queryCounter');
const { notFound, errorHandler, malformedJson } = require('./shared/middleware/errorHandler');
const { globalLimiter } = require('./shared/middleware/rateLimit');
const config = require('./config/env');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // swagger-ui inlines
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not permitted by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(malformedJson);
app.use(requestLogger);
if (config.dataSource === 'postgres' && config.nodeEnv === 'development') app.use(queryCounter);
app.use(globalLimiter);

const openapiSpec = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api/v1', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
