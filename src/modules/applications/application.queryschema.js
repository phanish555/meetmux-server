module.exports = {
  filterable: ['studentId', 'jobId', 'status'],
  sortable: ['appliedAt', 'updatedAt', 'status'],
  selectable: [
    'id', 'studentId', 'jobId', 'status', 'appliedAt', 'updatedAt', 'withdrawnAt',
  ],
  expandable: [],
  defaultSort: 'appliedAt',
  searchable: [],
};
