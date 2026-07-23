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

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/students end-to-end', () => {
  test('201 on success, DTO hides internal fields', async () => {
    const res = await request(app).post('/api/v1/students').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('kabir.menon@example.edu');
    // DTO does not leak internals
    expect(res.body.data).not.toHaveProperty('deletedAt');
    expect(res.body.data).not.toHaveProperty('idempotencyKey');
    // Location header present
    expect(res.headers.location).toMatch(/\/api\/v1\/students\//);
  });

  test('409 on duplicate email; response does not leak Prisma internals', async () => {
    await request(app).post('/api/v1/students').send(valid);
    const res = await request(app).post('/api/v1/students').send(valid);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESOURCE_CONFLICT');
    // No Prisma / Postgres jargon in the client-facing message
    expect(res.body.error.message.toLowerCase()).not.toMatch(/prisma|p2002|constraint|violate/);
  });

  test('unknown filter → 400 with allowed list (Task 3 strict parsing still enforced)', async () => {
    const res = await request(app).get('/api/v1/students?colour=blue');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
