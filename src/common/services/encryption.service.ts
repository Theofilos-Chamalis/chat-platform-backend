import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { getConfiguration } from 'src/utils/configuration';

@Injectable()
export class EncryptionService {
  private readonly key: string;
  private readonly iv: string;

  constructor() {
    this.key = getConfiguration().authCrypto.encryptionKey;
    this.iv = getConfiguration().authCrypto.encryptionIv;

    if (!this.key || !this.iv) {
      throw new Error(
        'Encryption key and IV must be set in environment variables',
      );
    }
  }

  encrypt(text: string): string {
    const key = CryptoJS.enc.Hex.parse(this.key);
    const iv = CryptoJS.enc.Hex.parse(this.iv);
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }

  decrypt(encryptedText: string): string {
    const key = CryptoJS.enc.Hex.parse(this.key);
    const iv = CryptoJS.enc.Hex.parse(this.iv);
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}
