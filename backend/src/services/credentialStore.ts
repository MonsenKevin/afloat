import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes (256 bits)
const IV_LENGTH = 12;  // bytes (96 bits, recommended for GCM)
const AUTH_TAG_LENGTH = 16; // bytes

/**
 * Validates that ENCRYPTION_KEY is set and is a valid 64-character hex string (32 bytes).
 * Throws a clear error if not.
 */
export function validateEncryptionKey(): void {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'ENCRYPTION_KEY environment variable must be a 64-character hex string (32 bytes)'
    );
  }
}

function getKey(): Buffer {
  validateEncryptionKey();
  return Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Ciphertext format: base64(ivHex:authTagHex:encryptedHex)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  return Buffer.from(combined, 'utf8').toString('base64');
}

/**
 * Decrypts a ciphertext string produced by `encrypt`.
 * Ciphertext format: base64(ivHex:authTagHex:encryptedHex)
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64').toString('utf8');
  const parts = combined.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
