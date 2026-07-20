function toPublic(application) {
  if (!application) return application;
  const { idempotencyKey, ...rest } = application;
  return rest;
}

function toPublicList(applications) {
  return applications.map(toPublic);
}

module.exports = { toPublic, toPublicList };
