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

// Hash a password for key derivation
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}
