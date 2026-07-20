module.exports = {
  filterable: ['companyId', 'type', 'location', 'minStipend', 'skill'],
  sortable: ['createdAt', 'deadline', 'stipend', 'title'],
  selectable: [
    'id', 'companyId', 'title', 'location', 'type', 'stipend', 'skills',
    'openings', 'deadline', 'createdAt', 'updatedAt',
  ],
  expandable: ['company'],
  defaultSort: 'createdAt',
  searchable: ['title', 'location'],
};
