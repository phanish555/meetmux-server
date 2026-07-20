function toPublic(interview) {
  if (!interview) return interview;
  return { ...interview };
}

function toPublicList(interviews) {
  return interviews.map(toPublic);
}

module.exports = { toPublic, toPublicList };
