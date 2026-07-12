// src/utils/encryption.js
const crypto = require('crypto');

class Encryption {
  static #encryptionKey = null;

  static initialize() {
    // Try to get the encryption key from environment variable
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (!envKey) {
      // If no key is provided in env, generate one and log it
      this.#encryptionKey = crypto.randomBytes(32);
      console.warn('No ENCRYPTION_KEY provided in environment variables. Generated new key:', 
        this.#encryptionKey.toString('hex'));
    } else {
      // Convert hex string to Buffer
      try {
        this.#encryptionKey = Buffer.from(envKey, 'hex');
        if (this.#encryptionKey.length !== 32) {
          throw new Error('Invalid key length');
        }
      } catch (error) {
        console.error('Invalid ENCRYPTION_KEY format. Generating new key.');
        this.#encryptionKey = crypto.randomBytes(32);
        console.warn('Generated new key:', this.#encryptionKey.toString('hex'));
      }
    }
  }

  static getEncryptionKey() {
    if (!this.#encryptionKey) {
      this.initialize();
    }
    return this.#encryptionKey;
  }

  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  static encryptApiKey(apiKey) {
    try {
      if (!apiKey) {
        throw new Error('API key cannot be empty');
      }

      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, this.getEncryptionKey(), iv);
      
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Return IV:AuthTag:EncryptedData format
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  static decryptApiKey(encryptedData) {
    try {
      if (!encryptedData) {
        throw new Error('Encrypted data cannot be empty');
      }

      const algorithm = 'aes-256-gcm';
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, this.getEncryptionKey(), iv);
      
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  static hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }
}

// Initialize encryption key when the module is loaded
Encryption.initialize();

module.exports = Encryption;