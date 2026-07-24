const request = require('supertest');
const app = require('../src/app');
const { prisma, truncateAll } = require('./helpers');

const goodSignup = {
  name: 'Fuzz Aarav',
  email: 'fuzz@example.edu',
  password: 'CorrectHorseBatteryStaple',
  branch: 'CS',
  graduationYear: 2027,
};

const FUZZ_VALUES = [
  null, undefined, 0, -1, 1.5, true, false,
  '', ' ', 'null', '[]', '{}', [], {},
  '../../etc/passwd', 'javascript:alert(1)',
  '%00', '%2e%2e%2f',
  'a'.repeat(10_000),
];

const FIELDS = ['name', 'email', 'branch', 'graduationYear', 'cgpa'];

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('fuzz — no combination of junk input produces a 5xx', () => {
  test('every fuzz value × every field returns < 500', async () => {
    for (const value of FUZZ_VALUES) {
      for (const field of FIELDS) {
        const body = { ...goodSignup, [field]: value };
        const res = await request(app).post('/api/v1/auth/register').send(body);
        expect(res.status).toBeLessThan(500);
      }
    }
  }, 60_000);
});
