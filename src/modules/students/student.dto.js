function toPublic(student) {
  if (!student) return student;
  return { ...student };
}

function toPublicList(students) {
  return students.map(toPublic);
}

module.exports = { toPublic, toPublicList };
