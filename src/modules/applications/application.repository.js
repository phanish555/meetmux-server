const seed = require('./application.mock');

let data = seed.map((a) => ({ ...a }));

module.exports = {
  findAll: async () => data.map((a) => ({ ...a })),
  findById: async (id) => {
    const found = data.find((a) => a.id === id);
    return found ? { ...found } : null;
  },
  findByStudentAndJob: async (studentId, jobId) => {
    const found = data.find((a) => a.studentId === studentId && a.jobId === jobId);
    return found ? { ...found } : null;
  },
  findByIdempotencyKey: async (key) => {
    if (!key) return null;
    const found = data.find((a) => a.idempotencyKey === key);
    return found ? { ...found } : null;
  },
  create: async (application) => {
    data.push(application);
    return { ...application };
  },
  update: async (id, patch) => {
    const i = data.findIndex((a) => a.id === id);
    if (i === -1) return null;
    data[i] = { ...data[i], ...patch, updatedAt: new Date().toISOString() };
    return { ...data[i] };
  },
  reset: async () => { data = seed.map((a) => ({ ...a })); },
};
