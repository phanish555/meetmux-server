const seed = require('./company.mock');

let data = seed.map((c) => ({ ...c }));

module.exports = {
  findAll: async () => data.map((c) => ({ ...c })),
  findById: async (id) => {
    const found = data.find((c) => c.id === id);
    return found ? { ...found } : null;
  },
  findByName: async (name) => {
    const found = data.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
    return found ? { ...found } : null;
  },
  create: async (company) => {
    data.push(company);
    return { ...company };
  },
  update: async (id, patch) => {
    const i = data.findIndex((c) => c.id === id);
    if (i === -1) return null;
    data[i] = { ...data[i], ...patch, updatedAt: new Date().toISOString() };
    return { ...data[i] };
  },
  reset: async () => { data = seed.map((c) => ({ ...c })); },
};
