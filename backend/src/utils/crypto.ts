import crypto from 'crypto';
import * as argon2 from '@node-rs/argon2';

/**
 * Hash a plaintext password using Argon2id
 */
export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
};

/**
 * Verify a plaintext password against an Argon2id hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    // If the hash is malformed or invalid, fail safely
    return false;
  }
};

/**
 * Generate a cryptographically secure random hexadecimal token
 */
export const generateRandomToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Compute SHA-256 hash of a raw token for safe database persistence
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a cryptographically secure public project key (alsh_pub_...)
 */
export const generateProjectPublicKey = (): string => {
  return `alsh_pub_${generateRandomToken(16)}`;
};

/**
 * Generate a cryptographically secure private project secret (alsh_sec_...)
 */
export const generateProjectPrivateSecret = (): string => {
  return `alsh_sec_${generateRandomToken(32)}`;
};

/**
 * Hash a private project secret using Argon2id for secure verification
 */
export const hashProjectSecret = async (secret: string): Promise<string> => {
  return hashPassword(secret);
};

/**
 * Verify a plaintext private project secret against its stored Argon2id hash
 */
export const verifyProjectSecret = async (secret: string, hash: string): Promise<boolean> => {
  return verifyPassword(secret, hash);
};
