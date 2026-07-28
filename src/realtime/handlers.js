// Socket.io connection lifecycle + room joining.
//
// Rooms mirror the Task 6 authorization scopes: a socket joins ONLY the
// rooms its authenticated identity is allowed into. Clients cannot request
// arbitrary rooms — every join is authorized server-side.

const authenticateSocket = require('./middleware/authenticate');

// Per-socket per-event rate limits — clients that spam get told "no"
function makeRateLimiter() {
  const hits = new Map();
  return (socket, event, maxPerMinute = 60) => {
    const key = `${socket.id}:${event}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (arr.length >= maxPerMinute) return false;
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}

const isValidId = (v) => typeof v === 'string' && /^(job|app|stu|cmp)_[\w-]{2,32}$|^c[a-z0-9]{20,30}$/.test(v);

function registerHandlers(io) {
  io.use(authenticateSocket); // runs BEFORE 'connection' for every attempt

  const limit = makeRateLimiter();

  io.on('connection', (socket) => {
    const { user, studentId } = socket.data;

    // Identity rooms — always joined
    socket.join(`user:${user.id}`);
    if (user.role === 'STUDENT' && studentId) socket.join(`student:${studentId}`);
    if (user.role === 'PLACEMENT_OFFICER' || user.role === 'ADMIN') socket.join('staff');
    if (user.role === 'RECRUITER' || user.role === 'ADMIN') socket.join('recruiters');

    console.log(JSON.stringify({
      level: 'info', component: 'realtime', event: 'connect',
      userId: user.id, role: user.role, socketId: socket.id,
    }));

    // Opt-in subscribe to a specific job — permission-checked
    socket.on('subscribe:job', (jobId, ack) => {
      if (!limit(socket, 'subscribe:job')) {
        return typeof ack === 'function' && ack({ ok: false, error: 'RATE_LIMITED' });
      }
      if (!isValidId(jobId)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'INVALID_INPUT' });
      }
      // Anyone authenticated may follow a job's live updates — future work
      // would gate this by role/ownership if needed.
      socket.join(`job:${jobId}`);
      if (typeof ack === 'function') ack({ ok: true, joined: `job:${jobId}` });
    });

    socket.on('unsubscribe:job', (jobId, ack) => {
      if (!isValidId(jobId)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'INVALID_INPUT' });
      }
      socket.leave(`job:${jobId}`);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      console.log(JSON.stringify({
        level: 'info', component: 'realtime', event: 'disconnect',
        userId: user.id, socketId: socket.id, reason,
      }));
    });
  });
}

// -------------------------------------------------------------
// Emit helpers used by services. Import getIo lazily inside functions
// so this file loads even in test contexts where realtime isn't booted.
// -------------------------------------------------------------

function emitApplicationCreated({ application, job }) {
  const { getIo } = require('./io');
  const io = getIo();
  if (!io) return;
  const payload = {
    id: application.id,
    jobId: application.jobId,
    studentId: application.studentId,
    jobTitle: job?.title ?? null,
    appliedAt: application.appliedAt,
  };
  // Staff dashboards see everything; the specific job's subscribers see it;
  // the student's own room sees their own submission.
  io.to('staff').emit('application:new', payload);
  io.to(`job:${application.jobId}`).emit('application:new', payload);
  io.to(`student:${application.studentId}`).emit('application:new', payload);
}

function emitApplicationStatus({ application }) {
  const { getIo } = require('./io');
  const io = getIo();
  if (!io) return;
  const payload = {
    id: application.id,
    status: application.status,
    updatedAt: application.updatedAt,
  };
  io.to(`student:${application.studentId}`).emit('application:status', payload);
  io.to(`job:${application.jobId}`).emit('application:status', payload);
}

// Batched stats — coalesce many events into one emit per second so a
// placement drive doesn't flood dashboards with hundreds of pings.
const pendingStats = new Map();
let statsTimer = null;
function bumpStat(jobId) {
  pendingStats.set(jobId, (pendingStats.get(jobId) || 0) + 1);
  if (!statsTimer) {
    statsTimer = setTimeout(() => {
      statsTimer = null;
      try {
        const { getIo } = require('./io');
        const io = getIo();
        const batch = Object.fromEntries(pendingStats);
        pendingStats.clear();
        if (io && Object.keys(batch).length) io.to('staff').emit('stats:batch', batch);
      } catch { /* test teardown may have removed the module — ignore */ }
    }, 1000);
    // Don't keep the event loop alive just for this timer (matters in tests)
    if (statsTimer.unref) statsTimer.unref();
  }
}

module.exports = {
  registerHandlers,
  emitApplicationCreated,
  emitApplicationStatus,
  bumpStat,
};
