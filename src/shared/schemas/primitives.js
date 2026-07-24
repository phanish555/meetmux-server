const { z } = require('zod');

// -----------------------------------------------------------
// Identifiers
// -----------------------------------------------------------
// Real IDs are `cuid`s (~24-32 chars) via Prisma. The seed data from Task 2
// also had legacy `stu_001` short IDs. Accept both so tests that use seed
// data don't break.
const idPattern = (prefix) =>
  new RegExp(`^(${prefix}_[a-z0-9]{2,32}|c[a-z0-9]{20,30})$`);

const studentId = z.string().regex(idPattern('stu'), 'must be a valid student id');
const companyId = z.string().regex(idPattern('cmp'), 'must be a valid company id');
const jobId = z.string().regex(idPattern('job'), 'must be a valid job id');
const applicationId = z.string().regex(idPattern('app'), 'must be a valid application id');
const interviewId = z.string().regex(idPattern('int'), 'must be a valid interview id');

// -----------------------------------------------------------
// Text — strip C0/C1 control chars + zero-width joiners, then trim.
// This is invisible-payload defence — control chars in a name field are
// used to smuggle through blocklists, log-line splitters, and terminals.
// -----------------------------------------------------------
const CONTROL_AND_ZWJ = new RegExp(
  '[\\u0000-\\u001F\\u007F\\u200B-\\u200D\\uFEFF]',
  'g',
);
const cleanString = z.string()
  .transform((s) => s.replace(CONTROL_AND_ZWJ, ''))
  .transform((s) => s.trim());

const shortText = (max = 200) => cleanString.pipe(z.string().min(1).max(max));
const longText = (max = 5000) => cleanString.pipe(z.string().max(max));

// Unicode-aware — covers non-Latin names properly
const personName = cleanString.pipe(
  z.string()
    .min(2, 'must be at least 2 characters')
    .max(100)
    .regex(/^[\p{L}\p{M}\s'.-]+$/u, 'contains characters that are not allowed in a name'),
);

const email = z.string()
  .trim()
  .toLowerCase()
  .email('must be a valid email address')
  .max(255);

// -----------------------------------------------------------
// Numbers
// -----------------------------------------------------------
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const cgpa = z.coerce.number().min(0).max(10);
const graduationYear = z.coerce.number().int().min(2020).max(2035);

// -----------------------------------------------------------
// Dates
// -----------------------------------------------------------
const isoDate = z.coerce.date();
const futureDate = isoDate.refine((d) => d > new Date(), 'must be in the future');

// -----------------------------------------------------------
// Domain enums — single source of truth
// -----------------------------------------------------------
const studentStatus = z.enum(['seeking', 'placed', 'inactive']);
const jobType = z.enum(['internship', 'full-time']);
const applicationStatus = z.enum([
  'submitted', 'under-review', 'shortlisted', 'rejected', 'offered', 'withdrawn',
]);
const interviewOutcome = z.enum(['pending', 'passed', 'failed']);

// -----------------------------------------------------------
// Pagination — every list endpoint shares this
// -----------------------------------------------------------
const pagination = z.object({
  page: z.coerce.number().int().positive().max(10_000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Sort spec: `?sort=-createdAt,name` with an allow-listed columns list.
const sortBy = (allowed) =>
  z.string()
    .optional()
    .refine((v) => {
      if (!v) return true;
      const fields = v.split(',').map((s) => s.trim().replace(/^-/, ''));
      return fields.every((f) => allowed.includes(f));
    }, { message: `sort fields must be one of: ${allowed.join(', ')}` });

// Query strings only ever arrive as strings. Coerce booleans so
// `?verified=true` becomes real `true`.
const boolFromQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

module.exports = {
  studentId, companyId, jobId, applicationId, interviewId,
  cleanString, shortText, longText, personName, email,
  positiveInt, nonNegativeInt, cgpa, graduationYear,
  isoDate, futureDate,
  studentStatus, jobType, applicationStatus, interviewOutcome,
  pagination, sortBy, boolFromQuery,
};
