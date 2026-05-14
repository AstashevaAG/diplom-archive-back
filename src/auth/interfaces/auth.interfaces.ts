import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
  tokens: TokenPair;
}

export interface PendingRegistrationResponse {
  requiresApproval: true;
  message: string;
}

export type RegisterResponse = AuthResponse | PendingRegistrationResponse;
