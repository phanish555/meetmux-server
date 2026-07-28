// Boots an in-memory HTTP server + Socket.io on an ephemeral port and asserts:
//   - unauthenticated sockets are refused
//   - authenticated sockets connect and land in their identity rooms
//   - events emitted by application.service arrive at the right client
//   - rooms actually isolate (a student does not see another student's events)

const http = require('http');
const { io: Client } = require('socket.io-client');

const app = require('../src/app');
const { initSocket } = require('../src/realtime/io');
const { registerHandlers } = require('../src/realtime/handlers');

const request = require('supertest');
const { prisma, truncateAll } = require('./helpers');

let httpServer;
let port;

async function bootRealtimeServer() {
  httpServer = http.createServer(app);
  const io = await initSocket(httpServer);
  registerHandlers(io);
  await new Promise((r) => httpServer.listen(0, r));
  port = httpServer.address().port;
}

async function shutdownRealtimeServer() {
  await new Promise((r) => httpServer.close(r));
}

async function registerAndLogin({ email, password = 'CorrectHorseBatteryStaple' }) {
  const name = 'Test ' + email.split('@')[0].replace(/[^a-zA-Z]/g, '');
  await request(app).post('/api/v1/auth/register').send({
    email, password, name, branch: 'CS', graduationYear: 2027,
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  return {
    token: login.body.data.accessToken,
    studentId: login.body.data.user.studentId,
  };
}

function connectClient(token) {
  return new Promise((resolve, reject) => {
    const client = Client(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      reconnection: false,
      transports: ['websocket'],
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', (err) => reject(err));
  });
}

beforeAll(bootRealtimeServer);
afterAll(async () => {
  await shutdownRealtimeServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

describe('socket authentication', () => {
  test('a socket without a token is refused with UNAUTHENTICATED', async () => {
    await expect(connectClient(null)).rejects.toMatchObject({ message: 'UNAUTHENTICATED' });
  });

  test('a socket with a garbage token is refused', async () => {
    await expect(connectClient('this-is-not-a-jwt')).rejects.toMatchObject({ message: 'UNAUTHENTICATED' });
  });

  test('a socket with a valid token connects', async () => {
    const { token } = await registerAndLogin({ email: 'valid-sock@example.edu' });
    const client = await connectClient(token);
    expect(client.connected).toBe(true);
    client.close();
  });
});

describe('event delivery via rooms', () => {
  test('a student receives application:new emitted to their student room', async () => {
    // Seed a company + job so we can apply
    const company = await prisma.company.create({
      data: { name: `Co-${Date.now()}`, industry: 'X', city: 'Y' },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id, title: 'T', city: 'Y',
        type: 'INTERNSHIP', deadline: new Date('2027-12-31'),
      },
    });

    const { token, studentId } = await registerAndLogin({ email: 'reception@example.edu' });
    const client = await connectClient(token);

    const received = new Promise((resolve) => {
      client.on('application:new', (data) => resolve(data));
    });

    // Trigger an application via the REST API
    await request(app).post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: job.id });

    const evt = await Promise.race([
      received,
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000)),
    ]);

    expect(evt.jobId).toBe(job.id);
    expect(evt.studentId).toBe(studentId);
    client.close();
  });

  test('rooms isolate: student A does not receive student B\'s application:new', async () => {
    const company = await prisma.company.create({
      data: { name: `Iso-${Date.now()}`, industry: 'X', city: 'Y' },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id, title: 'T', city: 'Y',
        type: 'INTERNSHIP', deadline: new Date('2027-12-31'),
      },
    });

    const a = await registerAndLogin({ email: 'stu-a@example.edu' });
    const b = await registerAndLogin({ email: 'stu-b@example.edu' });

    const clientA = await connectClient(a.token);
    let sawLeak = false;
    clientA.on('application:new', () => { sawLeak = true; });

    // Student B applies — clientA (student A) must NOT hear it
    await request(app).post('/api/v1/applications')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ jobId: job.id });

    await new Promise((r) => setTimeout(r, 300));
    expect(sawLeak).toBe(false);
    clientA.close();
  });
});
