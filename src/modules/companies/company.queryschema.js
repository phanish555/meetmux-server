module.exports = {
  filterable: ['industry', 'verified', 'location'],
  sortable: ['createdAt', 'name', 'employeeCount'],
  selectable: [
    'id', 'name', 'industry', 'location', 'employeeCount', 'verified',
    'createdAt', 'updatedAt',
  ],
  expandable: [],
  defaultSort: 'createdAt',
  searchable: ['name', 'industry', 'location'],
};
