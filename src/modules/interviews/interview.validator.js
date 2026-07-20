const OUTCOMES = ['pending', 'passed', 'failed'];

function validateCreateInterview(body) {
  const errors = [];
  if (!body.applicationId || typeof body.applicationId !== 'string') {
    errors.push({ field: 'applicationId', message: 'applicationId is required' });
  }
  const round = Number(body.round);
  if (!Number.isInteger(round) || round < 1) {
    errors.push({ field: 'round', message: 'round must be an integer >= 1' });
  }
  if (!body.scheduledAt || Number.isNaN(new Date(body.scheduledAt).getTime())) {
    errors.push({ field: 'scheduledAt', message: 'scheduledAt is required (ISO datetime)' });
  }
  if (body.outcome !== undefined && !OUTCOMES.includes(body.outcome)) {
    errors.push({ field: 'outcome', message: `outcome must be one of: ${OUTCOMES.join(', ')}` });
  }
  return errors;
}

module.exports = { validateCreateInterview, OUTCOMES };
