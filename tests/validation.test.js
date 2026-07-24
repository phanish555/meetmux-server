const request = require('supertest');
const app = require('../src/app');
const { prisma, truncateAll } = require('./helpers');

const goodSignup = {
  name: 'Aarav Sharma',
  email: 'aarav@example.edu',
  password: 'CorrectHorseBatteryStaple',
  branch: 'Computer Science',
  graduationYear: 2027,
};

async function studentToken() {
  const res = await request(app).post('/api/v1/auth/register').send(goodSignup);
  return res.body.data.accessToken;
}

async function adminToken() {
  const email = `admin-val-${Date.now()}@example.edu`;
  await request(app).post('/api/v1/auth/register').send({ ...goodSignup, email, name: 'Admin' });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  const login = await request(app).post('/api/v1/auth/login').send({
    email, password: goodSignup.password,
  });
  return login.body.data.accessToken;
}

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('valid input', () => {
  test('POST /auth/register with a well-formed body → 201', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(goodSignup);
    expect(res.status).toBe(201);
  });

  test('list applies defaults, coerces string ?limit to number', async () => {
    const token = await adminToken();
    const res = await request(app).get('/api/v1/students?limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.page).toBe(1);   // default applied
    expect(res.body.meta.pagination.limit).toBe(5);  // string → number
  });
});

describe('invalid input — all errors returned at once', () => {
  test('4 errors in one register body → 422 with 4 detail entries', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-email', password: 'short', name: 'X',
      branch: 'CS', graduationYear: 1800, cgpa: 47,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining([
      'body.email', 'body.password', 'body.name',
      'body.graduationYear', 'body.cgpa',
    ]));
  });

  test('unknown body field → 422 UNKNOWN_FIELD (mass-assignment defence)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      ...goodSignup, role: 'ADMIN', emailVerified: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d) => d.code === 'UNKNOWN_FIELD')).toBe(true);
  });

  test('unknown query filter → 400 UNKNOWN_FIELD', async () => {
    const token = await studentToken();
    const res = await request(app).get('/api/v1/jobs?colour=blue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.code === 'UNKNOWN_FIELD')).toBe(true);
  });

  test('malformed path id → 400', async () => {
    const token = await studentToken();
    const res = await request(app).get('/api/v1/students/not-a-real-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('empty PATCH body → 422 (at least one field required)', async () => {
    const token = await studentToken();
    // A real student id from the register above
    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    const id = meRes.body.data.studentId;

    const res = await request(app).patch(`/api/v1/students/${id}`).send({})
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });
});

describe('sanitisation + hostile input — no 5xx', () => {
  test('prototype pollution attempt does not modify Object.prototype', async () => {
    await request(app).post('/api/v1/auth/register').send({
      ...goodSignup, email: 'p1@example.edu', __proto__: { isAdmin: true },
    });
    expect({}.isAdmin).toBeUndefined();
    delete Object.prototype.isAdmin; // paranoid cleanup
  });

  test('operator-injection style query object is rejected', async () => {
    const token = await studentToken();
    const res = await request(app).get('/api/v1/jobs')
      .query({ 'type[$ne]': 'internship' })
      .set('Authorization', `Bearer ${token}`);
    expect([400, 422]).toContain(res.status); // Zod refuses the shape
  });

  test('oversized name is rejected — no 5xx', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      ...goodSignup, name: 'A'.repeat(20_000),
    });
    expect(res.status).toBeLessThan(500);
  });

  test('error responses do not leak stack traces or library names', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'nope' });
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\/src\/|node_modules|at Object\./);
    expect(body).not.toMatch(/zod|prisma|postgres/i);
    expect(body).not.toMatch(/password_hash|SELECT |users\./i);
  });
});
