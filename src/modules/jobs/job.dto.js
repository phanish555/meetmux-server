function toPublic(job) {
  if (!job) return job;
  return { ...job };
}

function toPublicList(jobs) {
  return jobs.map(toPublic);
}

module.exports = { toPublic, toPublicList };
