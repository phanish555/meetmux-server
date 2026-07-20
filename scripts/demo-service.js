// Calls the service layer directly. No Express, no HTTP, no port.
// Proof that services are decoupled from the transport.

const jobService = require('../src/modules/jobs/job.service');
const studentService = require('../src/modules/students/student.service');
const applicationService = require('../src/modules/applications/application.service');

(async () => {
  console.log('\n=== jobs (type=internship, sort=-stipend, fields=id/title/stipend) ===');
  const { items: jobs, total: jobTotal } = await jobService.listJobs({
    page: 1, limit: 5, offset: 0,
    sort: [{ field: 'stipend', direction: 'desc' }],
    filters: { type: 'internship' },
    fields: ['id', 'title', 'stipend'],
    expand: [], search: null,
  });
  console.log(`Total matching: ${jobTotal}`);
  console.table(jobs);

  console.log('\n=== students (status=seeking, sort=name) ===');
  const { items: students, total: sTotal } = await studentService.listStudents({
    page: 1, limit: 5, offset: 0,
    sort: [{ field: 'name', direction: 'asc' }],
    filters: { status: 'seeking' },
    fields: ['id', 'name', 'branch', 'cgpa'],
    expand: [], search: null,
  });
  console.log(`Total matching: ${sTotal}`);
  console.table(students);

  console.log('\n=== applications for stu_001 ===');
  const { items: apps } = await applicationService.listApplications({
    page: 1, limit: 5, offset: 0,
    sort: [{ field: 'appliedAt', direction: 'desc' }],
    filters: { studentId: 'stu_001' },
    fields: null, expand: [], search: null,
  });
  console.table(apps);

  console.log('\nOK — the service layer ran with no HTTP server.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
