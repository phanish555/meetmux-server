const config = require('../../config/env');

module.exports = config.dataSource === 'postgres'
  ? require('./interview.db.repository')
  : require('./interview.mock.repository');
