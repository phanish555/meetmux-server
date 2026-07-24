function toUserDTO(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    ...(user.studentId ? { studentId: user.studentId } : {}),
  };
}

module.exports = { toUserDTO };
