const config = require('../../config/env');

const studentMockRepo = require('./student.mock.repo');
const companyMockRepo = require('./company.mock.repo');
const jobMockRepo = require('./job.mock.repo');
const applicationMockRepo = require('./application.mock.repo');

const useMock = config.dataSource === 'mock';

module.exports = {
  studentRepo: useMock ? studentMockRepo : studentMockRepo,
  companyRepo: useMock ? companyMockRepo : companyMockRepo,
  jobRepo: useMock ? jobMockRepo : jobMockRepo,
  applicationRepo: useMock ? applicationMockRepo : applicationMockRepo,
};
