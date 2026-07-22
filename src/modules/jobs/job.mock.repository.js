const seed = require('./job.mock');

let data = seed.map((j) => ({ ...j }));

module.exports = {
  findAll: async () => data.map((j) => ({ ...j })),
  findById: async (id) => {
    const found = data.find((j) => j.id === id);
    return found ? { ...found } : null;
  },
  findByCompanyId: async (companyId) =>
    data.filter((j) => j.companyId === companyId).map((j) => ({ ...j })),
  create: async (job) => {
    data.push(job);
    return { ...job };
  },
  update: async (id, patch) => {
    const i = data.findIndex((j) => j.id === id);
    if (i === -1) return null;
    data[i] = { ...data[i], ...patch, updatedAt: new Date().toISOString() };
    return { ...data[i] };
  },
  reset: async () => { data = seed.map((j) => ({ ...j })); },
};
