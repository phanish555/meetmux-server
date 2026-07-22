const prisma = require('../../shared/prisma');

const NOT_DELETED = { deletedAt: null };
const INCLUDE = { jobSkills: { include: { skill: true } } };

function toDomain(j) {
  if (!j) return null;
  return {
    id: j.id,
    companyId: j.companyId,
    title: j.title,
    location: j.city,
    type: j.type === 'FULL_TIME' ? 'full-time' : 'internship',
    stipend: j.stipendPaise !== null && j.stipendPaise !== undefined ? Math.round(j.stipendPaise / 100) : null,
    skills: (j.jobSkills || []).map((js) => js.skill.name),
    openings: j.openings,
    deadline: j.deadline instanceof Date ? j.deadline.toISOString().slice(0, 10) : j.deadline,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

function toEnum(type) {
  return type === 'full-time' ? 'FULL_TIME' : 'INTERNSHIP';
}

async function connectOrCreateSkills(names) {
  if (!Array.isArray(names) || names.length === 0) return { create: [] };
  const skills = await Promise.all(
    names.map((name) =>
      prisma.skill.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  return { create: skills.map((sk) => ({ skillId: sk.id, required: true })) };
}

module.exports = {
  findAll: async () => {
    const rows = await prisma.job.findMany({
      where: NOT_DELETED,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await prisma.job.findFirst({
      where: { id, ...NOT_DELETED },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  findByCompanyId: async (companyId) => {
    const rows = await prisma.job.findMany({
      where: { companyId, ...NOT_DELETED },
      include: INCLUDE,
    });
    return rows.map(toDomain);
  },

  create: async (job) => {
    const jobSkills = await connectOrCreateSkills(job.skills);
    const row = await prisma.job.create({
      data: {
        companyId: job.companyId,
        title: job.title,
        city: job.location,
        type: toEnum(job.type),
        stipendPaise: job.stipend !== null && job.stipend !== undefined ? Math.round(job.stipend * 100) : null,
        openings: job.openings || 1,
        deadline: new Date(job.deadline),
        jobSkills,
      },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  update: async (id, patch) => {
    const data = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.location !== undefined) data.city = patch.location;
    if (patch.type !== undefined) data.type = toEnum(patch.type);
    if (patch.stipend !== undefined) {
      data.stipendPaise = patch.stipend !== null ? Math.round(patch.stipend * 100) : null;
    }
    if (patch.openings !== undefined) data.openings = patch.openings;
    if (patch.deadline !== undefined) data.deadline = new Date(patch.deadline);
    if (patch.skills !== undefined) {
      const jobSkills = await connectOrCreateSkills(patch.skills);
      await prisma.jobSkill.deleteMany({ where: { jobId: id } });
      data.jobSkills = jobSkills;
    }
    const row = await prisma.job.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    return toDomain(row);
  },

  reset: async () => {},
};
