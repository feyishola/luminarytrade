import { randomBytes, createHash } from 'crypto';

export function generateRefreshToken(): string {
  return randomBytes(64).toString('base64url');
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
