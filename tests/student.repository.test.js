const studentRepo = require('../src/modules/students/student.db.repository');
const { prisma, truncateAll } = require('./helpers');

const valid = {
  name: 'Test Student',
  email: 'test@example.edu',
  branch: 'Computer Science',
  graduationYear: 2026,
  cgpa: 8.5,
  skills: ['Node.js'],
};

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('student repository — CRUD happy path', () => {
  test('create → findById round-trip', async () => {
    const created = await studentRepo.create(valid);
    expect(created.id).toBeTruthy();
    expect(created.skills).toContain('Node.js');

    const found = await studentRepo.findById(created.id);
    expect(found.email).toBe('test@example.edu');
    expect(found.cgpa).toBe(8.5);
  });

  test('update mutates only the patched field', async () => {
    const created = await studentRepo.create(valid);
    const updated = await studentRepo.update(created.id, { branch: 'Electronics' });
    expect(updated.branch).toBe('Electronics');
    expect(updated.name).toBe(created.name);
  });

  test('softDelete hides the row from findById', async () => {
    const created = await studentRepo.create(valid);
    await studentRepo.softDelete(created.id);
    expect(await studentRepo.findById(created.id)).toBeNull();

    // But it's still physically in the DB
    const raw = await prisma.student.findUnique({ where: { id: created.id } });
    expect(raw).not.toBeNull();
    expect(raw.deletedAt).not.toBeNull();
  });

  test('findByEmail lowercases before lookup', async () => {
    await studentRepo.create(valid);
    const found = await studentRepo.findByEmail('TEST@example.edu');
    expect(found).not.toBeNull();
    expect(found.email).toBe('test@example.edu');
  });
});
