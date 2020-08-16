import * as crypto from 'crypto';
import { BN } from 'bn.js';
import * as CRC32 from 'crc-32';
import { ec } from 'elliptic';
import * as stringUtils from './stringUtils';
//const ec = new ec('secp256k1');

export interface Encryption {
  content: string;
  tag: Buffer;
}

export function encryptGCM(data: string, password: string, iv: string): Encryption {
  var cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(password), iv);
  var encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    content: encrypted,
    tag
  };
}

export function decryptGCM(encrypted: Encryption, password: string, iv: string) {
  var decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(password), iv);
  decipher.setAuthTag(encrypted.tag);
  var dec = decipher.update(encrypted.content, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function encryptCTR(text: string, password: string) {
  var cipher = crypto.createCipher('aes-256-ctr', password);
  var crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

export function decryptCTR(text: string, password: string) {
  var decipher = crypto.createDecipher('aes-256-ctr', password);
  var dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function getCrc32(hex: string) {
  var arr = Buffer.from(hex, 'hex');
  var checkSum = CRC32.buf(arr);
  var checkSum4Bytes = new Uint8Array(this.toBytesInt32(checkSum));
  var checkSumHex = stringUtils.byteArrayToHexString(checkSum4Bytes);
  return checkSumHex;
}
