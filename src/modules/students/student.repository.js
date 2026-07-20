const seed = require('./student.mock');

let data = seed.map((s) => ({ ...s }));

module.exports = {
  findAll: async () => data.map((s) => ({ ...s })),
  findById: async (id) => {
    const found = data.find((s) => s.id === id);
    return found ? { ...found } : null;
  },
  findByEmail: async (email) => {
    const found = data.find((s) => s.email.toLowerCase() === email.toLowerCase());
    return found ? { ...found } : null;
  },
  create: async (student) => {
    data.push(student);
    return { ...student };
  },
  update: async (id, patch) => {
    const i = data.findIndex((s) => s.id === id);
    if (i === -1) return null;
    data[i] = { ...data[i], ...patch, updatedAt: new Date().toISOString() };
    return { ...data[i] };
  },
  reset: async () => { data = seed.map((s) => ({ ...s })); },
};
