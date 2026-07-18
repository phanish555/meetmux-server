const users = [
  { id: 1, name: 'Aarav Sharma', role: 'student' },
  { id: 2, name: 'Diya Nair', role: 'mentor' },
];

function getAllUsers() {
  return users;
}

function getUserById(id) {
  return users.find((u) => u.id === Number(id));
}

module.exports = { getAllUsers, getUserById };
