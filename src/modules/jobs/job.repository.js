const config = require('../../config/env');

module.exports = config.dataSource === 'postgres'
  ? require('./job.db.repository')
  : require('./job.mock.repository');
