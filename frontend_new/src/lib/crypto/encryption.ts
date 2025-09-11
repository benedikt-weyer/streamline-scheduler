import CryptoJS from 'crypto-js';

// Derive a key from password using PBKDF2
export function deriveKey(password: string, salt: string, keySize: number = 256): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: keySize / 32,
    iterations: 10000
  }).toString();
}

// Generate a random salt
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(128/8).toString();
}

// Generate a random IV
export function generateIV(): string {
  return CryptoJS.lib.WordArray.random(128/8).toString();
}

// Encrypt data using AES-GCM
export function encryptData(plaintext: string, password: string): {
  encrypted: string;
  iv: string;
  salt: string;
} {
  const salt = generateSalt();
  const iv = generateIV();
  const key = deriveKey(password, salt);
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }).toString();
  
  return {
    encrypted,
    iv,
    salt
  };
}

// Decrypt data using AES-GCM
export function decryptData(
  encryptedData: string,
  password: string,
  iv: string,
  salt: string
): string {
  const key = deriveKey(password, salt);
  
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// Derive authentication hash from password (for server authentication)
export function deriveAuthHash(password: string, email: string): string {
  // Use email as salt for authentication hash to ensure uniqueness per user
  const authSalt = `auth_${email}`;
  return CryptoJS.PBKDF2(password, authSalt, {
    keySize: 256 / 32,
    iterations: 100000  // Higher iterations for auth hash
  }).toString();
}

// Derive encryption key from password (for client-side encryption)
export function deriveEncryptionKey(password: string, email: string): string {
  // Use different salt for encryption key
  const encryptionSalt = `encrypt_${email}`;
  return CryptoJS.PBKDF2(password, encryptionSalt, {
    keySize: 256 / 32,
    iterations: 100000  // Same high iteration count for security
  }).toString();
}

// Get the stored encryption key from localStorage
export function getEncryptionKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('encryption_key');
}

// Enhanced encryption function that uses stored encryption key
export function encryptDataWithStoredKey(plaintext: string): {
  encrypted: string;
  iv: string;
  salt: string;
} | null {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return null;
  
  return encryptData(plaintext, encryptionKey);
}

// Enhanced decryption function that uses stored encryption key
export function decryptDataWithStoredKey(
  encryptedData: string,
  iv: string,
  salt: string
): string | null {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return null;
  
  return decryptData(encryptedData, encryptionKey, iv, salt);
}

// Legacy function - kept for backwards compatibility
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}
