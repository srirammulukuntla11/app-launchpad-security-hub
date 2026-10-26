import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../src/utils/crypto';

describe('Cryptographic Utilities (Argon2id and Hashing)', () => {
  it('should hash a password using Argon2id', async () => {
    const password = 'SuperSecurePassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
  });

  it('should verify a valid password against its Argon2id hash', async () => {
    const password = 'CorrectPassword456!';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const password = 'CorrectPassword456!';
    const wrongPassword = 'WrongPassword456!';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it('should fail safely when verifying against a malformed hash', async () => {
    const isMatch = await verifyPassword('password', 'malformed_non_argon_hash');
    expect(isMatch).toBe(false);
  });

  it('should generate secure random hex tokens with expected byte length', () => {
    const token = generateRandomToken(32);
    expect(token).toBeDefined();
    expect(token.length).toBe(64); // 32 bytes in hex = 64 characters
  });

  it('should compute consistent SHA-256 hash for tokens', () => {
    const token = 'my-sample-refresh-token';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
