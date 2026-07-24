const prisma = require('../../shared/prisma');

const NOT_DELETED = { deletedAt: null };
const INCLUDE = { studentSkills: { include: { skill: true } } };

function toDomain(s) {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    branch: s.branch,
    graduationYear: s.graduationYear,
    cgpa: s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa) : null,
    skills: (s.studentSkills || []).map((ss) => ss.skill.name),
    status: s.status.toLowerCase().replace(/_/g, '-'),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toEnum(status) {
  return String(status || 'seeking').toUpperCase().replace(/-/g, '_');
}

async function connectOrCreateSkills(names, client) {
  if (!Array.isArray(names) || names.length === 0) return { create: [] };
  const skills = await Promise.all(
    names.map((name) =>
      client.skill.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  return { create: skills.map((sk) => ({ skillId: sk.id, level: 1 })) };
}

module.exports = {
  findAll: async (client = prisma) => {
    const rows = await client.student.findMany({
      where: NOT_DELETED,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  },

  findById: async (id, client = prisma) => {
    const row = await client.student.findFirst({
      where: { id, ...NOT_DELETED },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  findByEmail: async (email, client = prisma) => {
    const row = await client.student.findFirst({
      where: { email: String(email).toLowerCase(), ...NOT_DELETED },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  create: async (student, client = prisma) => {
    const studentSkills = await connectOrCreateSkills(student.skills, client);
    const row = await client.student.create({
      data: {
        name: student.name,
        email: student.email,
        branch: student.branch,
        graduationYear: student.graduationYear,
        cgpa: student.cgpa,
        status: toEnum(student.status),
        ...(student.userId ? { userId: student.userId } : {}),
        studentSkills,
      },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  findByUserId: async (userId, client = prisma) => {
    const row = await client.student.findFirst({
      where: { userId, deletedAt: null },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  update: async (id, patch, client = prisma) => {
    const data = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.branch !== undefined) data.branch = patch.branch;
    if (patch.graduationYear !== undefined) data.graduationYear = patch.graduationYear;
    if (patch.cgpa !== undefined) data.cgpa = patch.cgpa;
    if (patch.status !== undefined) data.status = toEnum(patch.status);
    if (patch.skills !== undefined) {
      const studentSkills = await connectOrCreateSkills(patch.skills, client);
      await client.studentSkill.deleteMany({ where: { studentId: id } });
      data.studentSkills = studentSkills;
    }
    const row = await client.student.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    return toDomain(row);
  },

  softDelete: async (id, client = prisma) => {
    const row = await client.student.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  reset: async () => {},
};
