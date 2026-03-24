import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash' | 'refreshToken'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return safeUser;
}
