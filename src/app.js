const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const requestLogger = require('./shared/middleware/requestLogger');
const queryCounter = require('./shared/middleware/queryCounter');
const { notFound, errorHandler, malformedJson } = require('./shared/middleware/errorHandler');
const config = require('./config/env');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(malformedJson);
app.use(requestLogger);
if (config.dataSource === 'postgres') app.use(queryCounter);

const openapiSpec = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api/v1', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
