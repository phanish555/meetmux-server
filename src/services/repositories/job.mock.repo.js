const jobs = require('../../mocks/jobs.mock');

let data = jobs.map((j) => ({ ...j }));

module.exports = {
  findAll: async () => data.map((j) => ({ ...j })),
  findById: async (id) => {
    const found = data.find((j) => j.id === id);
    return found ? { ...found } : null;
  },
};
