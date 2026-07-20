const APPLICATION_STATUSES = ['submitted', 'under-review', 'shortlisted', 'rejected', 'offered', 'withdrawn'];

function validateCreateApplication(body) {
  const errors = [];
  if (!body.studentId || typeof body.studentId !== 'string') {
    errors.push({ field: 'studentId', message: 'studentId is required' });
  }
  if (!body.jobId || typeof body.jobId !== 'string') {
    errors.push({ field: 'jobId', message: 'jobId is required' });
  }
  return errors;
}

function validateStatusPatch(body) {
  const errors = [];
  if (!body.status || !APPLICATION_STATUSES.includes(body.status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${APPLICATION_STATUSES.join(', ')}`,
    });
  }
  return errors;
}

module.exports = { validateCreateApplication, validateStatusPatch, APPLICATION_STATUSES };
