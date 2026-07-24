const request = require('supertest');
const app = require('../src/app');
const { prisma, truncateAll } = require('./helpers');

const valid = {
  name: 'Kabir Menon',
  email: 'kabir.menon@example.edu',
  branch: 'Computer Science',
  graduationYear: 2027,
  cgpa: 8.2,
  skills: ['Node.js'],
};

async function adminToken() {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Admin User',
    email: 'admin-api@example.edu',
    password: 'CorrectHorseBatteryStaple',
    branch: 'CS',
    graduationYear: 2027,
  });
  await prisma.user.update({ where: { email: 'admin-api@example.edu' }, data: { role: 'ADMIN' } });
  // Log back in so the new token carries ADMIN role
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin-api@example.edu',
    password: 'CorrectHorseBatteryStaple',
  });
  return login.body.data.accessToken;
}

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/students end-to-end (admin-only route)', () => {
  test('201 on success, DTO hides internal fields', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('kabir.menon@example.edu');
    expect(res.body.data).not.toHaveProperty('deletedAt');
    expect(res.body.data).not.toHaveProperty('idempotencyKey');
    expect(res.headers.location).toMatch(/\/api\/v1\/students\//);
  });

  test('409 on duplicate email; response does not leak Prisma internals', async () => {
    const token = await adminToken();
    await request(app).post('/api/v1/students').set('Authorization', `Bearer ${token}`).send(valid);
    const res = await request(app).post('/api/v1/students').set('Authorization', `Bearer ${token}`).send(valid);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESOURCE_CONFLICT');
    expect(res.body.error.message.toLowerCase()).not.toMatch(/prisma|p2002|constraint|violate/);
  });

  test('unknown filter → 400 with allowed list (Task 3 strict parsing still enforced)', async () => {
    const token = await adminToken();
    const res = await request(app).get('/api/v1/students?colour=blue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  test('no token → 401', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
