const students = require('../../mocks/students.mock');

let data = students.map((s) => ({ ...s }));

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
};
