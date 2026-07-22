const config = require('../../config/env');

module.exports = config.dataSource === 'postgres'
  ? require('./student.db.repository')
  : require('./student.mock.repository');
