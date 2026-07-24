const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config/env');
const { prisma, truncateAll } = require('./helpers');

const signup = {
  name: 'Aarav Sharma',
  email: 'aarav.sharma@example.edu',
  password: 'CorrectHorseBatteryStaple',
  branch: 'Computer Science',
  graduationYear: 2027,
};

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('registration & password storage', () => {
  test('registers and returns tokens; response never includes the hash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(signup);

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  test('stored password is hashed with bcrypt, never plaintext', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    const user = await prisma.user.findUnique({ where: { email: signup.email } });

    expect(user.passwordHash).not.toBe(signup.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt marker
  });

  test('two accounts with the same password get different hashes (salt)', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    await request(app).post('/api/v1/auth/register').send({ ...signup, email: 'other@example.edu', name: 'Other' });

    const a = await prisma.user.findUnique({ where: { email: signup.email } });
    const b = await prisma.user.findUnique({ where: { email: 'other@example.edu' } });
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  test('duplicate email → 409', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    const res = await request(app).post('/api/v1/auth/register').send(signup);
    expect(res.status).toBe(409);
  });

  test('short password rejected (< 12 chars)', async () => {
    const res = await request(app).post('/api/v1/auth/register')
      .send({ ...signup, password: 'short' });
    expect(res.status).toBe(422);
  });
});

describe('login', () => {
  test('wrong password and unknown email return identical message', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    const wrongPw = await request(app).post('/api/v1/auth/login')
      .send({ email: signup.email, password: 'WrongPasswordABC' });
    const noUser = await request(app).post('/api/v1/auth/login')
      .send({ email: 'nobody@example.edu', password: 'WrongPasswordABC' });

    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  test('successful login returns access + refresh tokens', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: signup.email, password: signup.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  test('locks the account after 5 failed attempts', async () => {
    await request(app).post('/api/v1/auth/register').send(signup);
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/v1/auth/login')
        .send({ email: signup.email, password: 'WrongOne1234' });
    }
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: signup.email, password: signup.password });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('access token validation', () => {
  async function registerAndGetToken() {
    const res = await request(app).post('/api/v1/auth/register').send(signup);
    return res.body.data.accessToken;
  }

  test('missing Authorization → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('valid token → /auth/me returns caller identity', async () => {
    const token = await registerAndGetToken();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(signup.email);
    expect(res.body.data.role).toBe('STUDENT');
  });

  test('token signed with the WRONG secret → 401', async () => {
    const forged = jwt.sign(
      { sub: 'x', role: 'ADMIN', type: 'access' },
      'attacker-secret-that-is-obviously-not-ours-and-long-enough-1',
      { expiresIn: '15m', issuer: config.auth.issuer, audience: config.auth.audience }
    );
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('alg:none token → 401 (algorithm pinned server-side)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'x', role: 'ADMIN', type: 'access',
      iss: config.auth.issuer, aud: config.auth.audience,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const res = await request(app).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(res.status).toBe(401);
  });

  test('expired token → 401 TOKEN_EXPIRED', async () => {
    const expired = jwt.sign(
      { sub: 'x', role: 'STUDENT', type: 'access' },
      config.auth.accessSecret,
      { expiresIn: '-1h', issuer: config.auth.issuer, audience: config.auth.audience }
    );
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('refresh token used as access token → 401 (type mismatch)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(signup);
    const refresh = res.body.data.refreshToken;
    const bad = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${refresh}`);
    expect(bad.status).toBe(401);
  });
});

describe('authorization — role & ownership', () => {
  async function registerAs(email, role = 'STUDENT') {
    // Derive a name from the email that satisfies the personName regex
    // (letters + spaces only, min 2 chars).
    const name = 'Test ' + (email.split('@')[0].replace(/[^a-zA-Z]/g, '') || 'User');
    const res = await request(app).post('/api/v1/auth/register').send({
      ...signup, email, name, password: signup.password,
    });
    if (role !== 'STUDENT') {
      await prisma.user.update({ where: { email }, data: { role } });
      // Log back in to refresh the role in the token
      const login = await request(app).post('/api/v1/auth/login')
        .send({ email, password: signup.password });
      return { token: login.body.data.accessToken, userId: res.body.data.user.id, studentId: res.body.data.user.studentId };
    }
    return {
      token: res.body.data.accessToken,
      userId: res.body.data.user.id,
      studentId: res.body.data.user.studentId,
    };
  }

  test('student cannot list all students (403)', async () => {
    const { token } = await registerAs('s1@example.edu');
    const res = await request(app).get('/api/v1/students').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('placement officer can list all students (200)', async () => {
    const { token } = await registerAs('po@example.edu', 'PLACEMENT_OFFICER');
    const res = await request(app).get('/api/v1/students').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('IDOR: student A cannot read student B\'s application (404, not 403)', async () => {
    // Seed a company + job for the application
    const company = await prisma.company.create({
      data: { name: 'Acme', industry: 'X', city: 'Y' },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id, title: 'T', city: 'Y', type: 'INTERNSHIP',
        deadline: new Date('2027-12-31'),
      },
    });

    // Student A registers and creates their own application
    const a = await registerAs('a@example.edu');
    const create = await request(app).post('/api/v1/applications')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ jobId: job.id });
    expect(create.status).toBe(201);
    const appId = create.body.data.id;

    // Student B tries to read it
    const b = await registerAs('b@example.edu');
    const res = await request(app).get(`/api/v1/applications/${appId}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  test('student cannot change application status (403 role check)', async () => {
    const company = await prisma.company.create({ data: { name: 'B', industry: 'X', city: 'Y' } });
    const job = await prisma.job.create({
      data: { companyId: company.id, title: 'T', city: 'Y', type: 'INTERNSHIP', deadline: new Date('2027-12-31') },
    });
    const s = await registerAs('s2@example.edu');
    const create = await request(app).post('/api/v1/applications')
      .set('Authorization', `Bearer ${s.token}`).send({ jobId: job.id });
    const appId = create.body.data.id;

    const res = await request(app).patch(`/api/v1/applications/${appId}/status`)
      .set('Authorization', `Bearer ${s.token}`)
      .send({ status: 'offered' });
    expect(res.status).toBe(403);
  });
});

describe('refresh token rotation & reuse detection', () => {
  async function registerAndGetRefresh() {
    const res = await request(app).post('/api/v1/auth/register').send(signup);
    return res.body.data.refreshToken;
  }

  test('rotates on use: new token issued, old revoked', async () => {
    const original = await registerAndGetRefresh();
    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(original);
  });

  test('replaying a rotated token revokes the whole family', async () => {
    const original = await registerAndGetRefresh();
    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(first.status).toBe(200);

    // Replay the ORIGINAL token — simulates a stolen refresh
    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toMatch(/reuse detected/i);

    // The legitimate new token is now dead too
    const afterReplay = await request(app).post('/api/v1/auth/refresh')
      .send({ refreshToken: first.body.data.refreshToken });
    expect(afterReplay.status).toBe(401);
  });
});
