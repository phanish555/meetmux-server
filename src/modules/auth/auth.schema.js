const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'letmein12345',
  'welcome12345', 'iloveyou1234', 'admin1234567',
]);

const password = z.string()
  .min(12, 'must be at least 12 characters')
  .max(128, 'must be at most 128 characters')
  .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()),
    { message: 'this password is too common — please choose another' });

const register = {
  body: z.object({
    email: p.email,
    password,
    name: p.personName,
    branch: p.shortText(120),
    graduationYear: p.graduationYear,
    cgpa: p.cgpa.optional(),
    skills: z.array(p.shortText(60)).max(30).optional(),
  }).strict(),
};

const login = {
  body: z.object({
    email: p.email,
    password: z.string().min(1).max(128), // don't strict-check the password on login
  }).strict(),
};

const refresh = {
  body: z.object({
    refreshToken: z.string().min(1).max(512).optional(),
  }).strict().optional(),
};

const logout = {
  body: z.object({
    refreshToken: z.string().min(1).max(512).optional(),
  }).strict().optional(),
};

module.exports = { register, login, refresh, logout };
