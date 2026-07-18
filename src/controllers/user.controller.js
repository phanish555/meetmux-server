const userService = require('../services/user.service');

function listUsers(req, res) {
  const users = userService.getAllUsers();
  res.status(200).json({ count: users.length, data: users });
}

function getUser(req, res) {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }

  const user = userService.getUserById(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ data: user });
}

module.exports = { listUsers, getUser };
