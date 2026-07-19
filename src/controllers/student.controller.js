const studentService = require('../services/student.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { parsePagination, buildMeta } = require('../utils/paginate');

const listStudents = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { items, total } = await studentService.listStudents(req.query, { offset, limit });
  return success(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await studentService.getStudent(req.params.id);
  return success(res, { data: student });
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentService.createStudent(req.body);
  res.setHeader('Location', `/api/v1/students/${student.id}`);
  return success(res, { data: student, status: 201 });
});

module.exports = { listStudents, getStudent, createStudent };
