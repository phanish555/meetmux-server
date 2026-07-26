const service = require('./student.service');
const applicationService = require('../applications/application.service');
const applicationDto = require('../applications/application.dto');
const jobService = require('../jobs/job.service');
const querySchema = require('./student.queryschema');
const applicationQuerySchema = require('../applications/application.queryschema');
const dto = require('./student.dto');
const { parseQuery } = require('../../shared/query/queryParser');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, querySchema);
  const { items, total } = await service.listStudents(q);
  return success(res, {
    data: dto.toPublicList(items),
    meta: service.buildListMeta(q, total),
  });
});

const getById = asyncHandler(async (req, res) => {
  const student = await service.getStudent(req.params.id);
  return success(res, { data: dto.toPublic(student) });
});

const create = asyncHandler(async (req, res) => {
  const student = await service.createStudent(req.body);
  res.setHeader('Location', `/api/v1/students/${student.id}`);
  return success(res, { data: dto.toPublic(student), status: 201 });
});

const update = asyncHandler(async (req, res) => {
  const student = await service.updateStudent(req.params.id, req.body);
  return success(res, { data: dto.toPublic(student) });
});

const listApplicationsForStudent = asyncHandler(async (req, res) => {
  await service.getStudent(req.params.id); // 404 if missing
  const q = parseQuery(req.query, applicationQuerySchema);
  const nested = { ...q, filters: { ...q.filters, studentId: req.params.id } };
  const { items, total } = await applicationService.listApplications(nested);
  return success(res, {
    data: applicationDto.toPublicList(items),
    meta: applicationService.buildListMeta(nested, total),
  });
});

const recommendedJobs = asyncHandler(async (req, res) => {
  // Ownership: a student may only see their own recommendations
  if (req.user.role === 'STUDENT' && req.user.studentId !== req.params.id) {
    const ApiError = require('../../shared/errors/ApiError');
    throw ApiError.notFound(`Student with id ${req.params.id} was not found`);
  }
  await service.getStudent(req.params.id);
  const jobs = await jobService.recommendedForStudent(req.params.id);
  return success(res, { data: jobs });
});

module.exports = { list, getById, create, update, listApplicationsForStudent, recommendedJobs };
