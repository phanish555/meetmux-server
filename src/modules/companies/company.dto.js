function toPublic(company) {
  if (!company) return company;
  return { ...company };
}

function toPublicList(companies) {
  return companies.map(toPublic);
}

module.exports = { toPublic, toPublicList };
