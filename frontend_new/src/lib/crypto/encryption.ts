import CryptoJS from 'crypto-js';

// Derive a key from password using PBKDF2
export function deriveKey(password: string, salt: string, keySize: number = 256): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: keySize / 32,
    iterations: 10000
  }).toString();
}

// Legacy function name for compatibility
export const deriveKeyFromPassword = (password: string, salt: string): string => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
};

// Generate a random salt
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(128/8).toString();
}

// Generate a random IV
export function generateIV(): string {
  return CryptoJS.lib.WordArray.random(128/8).toString();
}

// Encrypt data using AES with derived key and IV (modern version)
export function encryptDataWithPassword(plaintext: string, password: string): {
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

// Decrypt data using AES with derived key and IV (modern version)
export function decryptDataWithPassword(
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

// Legacy encrypt function for compatibility
export const encryptData = (data: any, key: string, iv: string): string => {
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return encrypted.toString();
};

// Legacy decrypt function for compatibility
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
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      if (!silenceErrors) {
        console.error('Decryption failed: Empty result (wrong key or corrupted data)');
      }
      return null;
    }
    
    try {
      return JSON.parse(decryptedString);
    } catch (parseError) {
      if (!silenceErrors) {
        console.error('Failed to parse decrypted JSON:', parseError);
      }
      return null;
    }
  } catch (error) {
    if (!silenceErrors) {
      console.error('Decryption error:', error);
    }
    return null;
  }
};

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
  
  return encryptDataWithPassword(plaintext, encryptionKey);
}

// Enhanced decryption function that uses stored encryption key
export function decryptDataWithStoredKey(
  encryptedData: string,
  iv: string,
  salt: string
): string | null {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return null;
  
  return decryptDataWithPassword(encryptedData, encryptionKey, iv, salt);
}

// Legacy function - kept for backwards compatibility
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}
