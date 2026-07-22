const config = require('../../config/env');

module.exports = config.dataSource === 'postgres'
  ? require('./company.db.repository')
  : require('./company.mock.repository');
