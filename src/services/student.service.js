const { studentRepo } = require('./repositories');
const ApiError = require('../utils/ApiError');
const { validateCreateStudent } = require('../validators/student.validator');

function applyFilters(list, query) {
  let out = list;

  if (query.status) {
    out = out.filter((s) => s.status === query.status);
  }
  if (query.branch) {
    out = out.filter((s) => s.branch.toLowerCase() === String(query.branch).toLowerCase());
  }
  if (query.graduationYear) {
    out = out.filter((s) => s.graduationYear === Number(query.graduationYear));
  }
  if (query.skill) {
    const skill = String(query.skill).toLowerCase();
    out = out.filter((s) => s.skills.some((k) => k.toLowerCase() === skill));
  }
  if (query.search) {
    const term = String(query.search).toLowerCase();
    out = out.filter(
      (s) => s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term)
    );
  }

  return out;
}

async function listStudents(query, { offset, limit }) {
  const all = await studentRepo.findAll();
  const filtered = applyFilters(all, query);
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

async function getStudent(id) {
  const student = await studentRepo.findById(id);
  if (!student) {
    throw ApiError.notFound(`Student with id ${id} was not found`);
  }
  return student;
}

async function createStudent(body) {
  const errors = validateCreateStudent(body);
  if (errors.length) {
    throw ApiError.validation('One or more fields are invalid', errors);
  }

  const existing = await studentRepo.findByEmail(body.email);
  if (existing) {
    throw ApiError.conflict(`A student with email ${body.email} already exists`);
  }

  const all = await studentRepo.findAll();
  const now = new Date().toISOString();

  const student = {
    id: `stu_${String(all.length + 1).padStart(3, '0')}`,
    name: body.name.trim(),
    email: body.email.toLowerCase().trim(),
    branch: body.branch.trim(),
    graduationYear: Number(body.graduationYear),
    cgpa: body.cgpa !== undefined ? Number(body.cgpa) : null,
    skills: body.skills || [],
    status: body.status || 'seeking',
    createdAt: now,
  };

  return studentRepo.create(student);
}

module.exports = { listStudents, getStudent, createStudent };
