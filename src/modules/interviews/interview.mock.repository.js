const seed = require('./interview.mock');

let data = seed.map((i) => ({ ...i }));

module.exports = {
  findAll: async () => data.map((i) => ({ ...i })),
  findById: async (id) => {
    const found = data.find((i) => i.id === id);
    return found ? { ...found } : null;
  },
  findByApplicationAndRound: async (applicationId, round) => {
    const found = data.find((i) => i.applicationId === applicationId && i.round === round);
    return found ? { ...found } : null;
  },
  create: async (interview) => {
    data.push(interview);
    return { ...interview };
  },
  reset: async () => { data = seed.map((i) => ({ ...i })); },
};
