module.exports = {
  filterable: ['status', 'branch', 'graduationYear', 'skill'],
  sortable: ['createdAt', 'graduationYear', 'cgpa', 'name'],
  selectable: [
    'id', 'name', 'email', 'branch', 'graduationYear', 'cgpa', 'skills',
    'status', 'createdAt', 'updatedAt',
  ],
  expandable: [],
  defaultSort: 'createdAt',
  searchable: ['name', 'email'],
};
