import CryptoJS from 'crypto-js';

/**
 * Utility functions for client-side encryption and decryption of can-do list items
 * using a key derived from the user's password
 */

// Generate a key from the user's password and a salt
export const deriveKeyFromPassword = (password: string, salt: string): string => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
};

// Generate a random salt for key derivation
export const generateSalt = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

// Generate a random initialization vector (IV)
export const generateIV = (): string => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

// Encrypt data using the derived key and IV
export const encryptData = (data: any, key: string, iv: string): string => {
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return encrypted.toString();
};

// Decrypt data using the derived key and IV
export const decryptData = (encryptedData: string, key: string, iv: string, silenceErrors = false): any => {
  try {
    // Validate IV is a proper hex format
    if (!/^[0-9a-fA-F]+$/.test(iv)) {
      throw new Error('Invalid IV format: must be a hex string');
    }
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!jsonString) {
      throw new Error('Decryption failed: Empty result');
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    if (!silenceErrors) {
      console.error('Decryption failed:', error);
    }
    return null;
  }
};

// Hash the user's password for storage in cookie
// Note: This is only for local encryption purposes, not for authentication
export const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString();
};

// Cookie management functions for storing the hashed password
export const storeHashedPassword = (hashedPassword: string): void => {
  document.cookie = `encKey=${hashedPassword};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
};

export const getHashedPassword = (): string | null => {
  const match = RegExp(/encKey=([^;]+)/).exec(document.cookie);
  return match ? match[1] : null;
};

export const clearHashedPassword = (): void => {
  document.cookie = 'encKey=;path=/;max-age=0';
};