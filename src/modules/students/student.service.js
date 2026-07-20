const repo = require('./student.repository');
const ApiError = require('../../shared/errors/ApiError');
const { validateCreateStudent, validateUpdateStudent } = require('./student.validator');
const querySchema = require('./student.queryschema');
const {
  applyFilters, applySearch, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');

const FILTER_HANDLERS = {
  status: (s, v) => s.status === v,
  branch: (s, v) => s.branch.toLowerCase() === String(v).toLowerCase(),
  graduationYear: (s, v) => s.graduationYear === Number(v),
  skill: (s, v) => s.skills.some((k) => k.toLowerCase() === String(v).toLowerCase()),
};

async function listStudents(q) {
  const all = await repo.findAll();
  let result = applyFilters(all, q.filters, FILTER_HANDLERS);
  result = applySearch(result, q.search, querySchema.searchable);
  result = applySort(result, q.sort);

  const total = result.length;
  const items = applyFields(result.slice(q.offset, q.offset + q.limit), q.fields);
  return { items, total };
}

async function getStudent(id) {
  const student = await repo.findById(id);
  if (!student) throw ApiError.notFound(`Student with id ${id} was not found`);
  return student;
}

async function createStudent(body) {
  const errors = validateCreateStudent(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  // INV-5: email uniqueness (case-insensitive)
  const existing = await repo.findByEmail(body.email);
  if (existing) {
    throw ApiError.conflict(`A student with email ${body.email} already exists`);
  }

  const all = await repo.findAll();
  const now = new Date().toISOString();

  return repo.create({
    id: `stu_${String(all.length + 1).padStart(3, '0')}`,
    name: body.name.trim(),
    email: body.email.toLowerCase().trim(),
    branch: body.branch.trim(),
    graduationYear: Number(body.graduationYear),
    cgpa: body.cgpa !== undefined ? Number(body.cgpa) : null,
    skills: body.skills || [],
    status: body.status || 'seeking',
    createdAt: now,
    updatedAt: now,
  });
}

async function updateStudent(id, body) {
  const errors = validateUpdateStudent(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const student = await repo.findById(id);
  if (!student) throw ApiError.notFound(`Student with id ${id} was not found`);

  const patch = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.branch !== undefined) patch.branch = body.branch.trim();
  if (body.graduationYear !== undefined) patch.graduationYear = Number(body.graduationYear);
  if (body.cgpa !== undefined) patch.cgpa = Number(body.cgpa);
  if (body.skills !== undefined) patch.skills = body.skills;
  if (body.status !== undefined) patch.status = body.status;

  return repo.update(id, patch);
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

module.exports = { listStudents, getStudent, createStudent, updateStudent, buildListMeta };
