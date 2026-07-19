const companies = require('../../mocks/companies.mock');

let data = companies.map((c) => ({ ...c }));

module.exports = {
  findAll: async () => data.map((c) => ({ ...c })),
  findById: async (id) => {
    const found = data.find((c) => c.id === id);
    return found ? { ...found } : null;
  },
};
