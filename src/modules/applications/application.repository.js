const config = require('../../config/env');

module.exports = config.dataSource === 'postgres'
  ? require('./application.db.repository')
  : require('./application.mock.repository');
