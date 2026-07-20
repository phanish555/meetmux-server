module.exports = {
  filterable: ['applicationId', 'outcome', 'round'],
  sortable: ['scheduledAt', 'round', 'createdAt'],
  selectable: [
    'id', 'applicationId', 'round', 'scheduledAt', 'outcome', 'createdAt', 'updatedAt',
  ],
  expandable: [],
  defaultSort: 'scheduledAt',
  searchable: [],
};
