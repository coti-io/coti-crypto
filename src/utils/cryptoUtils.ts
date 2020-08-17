import * as crypto from 'crypto';
import BN from 'bn.js';
import * as CRC32 from 'crc-32';
import * as elliptic from 'elliptic';
import * as stringUtils from './stringUtils';

const ec = new elliptic.ec('secp256k1');
const regexp = /^[0-9a-fA-F]+$/;
const publicKeyLength = 128;
const orderGHex = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141';
const orderG = new BN(orderGHex, 16);

export interface Encryption {
  content: string;
  tag: Buffer;
}

export interface PublicKey {
  x: string;
  y: string;
}

export type Signature = elliptic.ec.Signature;
export type KeyPair = elliptic.ec.KeyPair;

export function encryptGCM(data: string, password: string, iv: string): Encryption {
  let cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(password), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    content: encrypted,
    tag
  };
}

export function decryptGCM(encrypted: Encryption, password: string, iv: string) {
  let decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(password), iv);
  decipher.setAuthTag(encrypted.tag);
  let dec = decipher.update(encrypted.content, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function encryptCTR(text: string, password: string) {
  let cipher = crypto.createCipher('aes-256-ctr', password);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

export function decryptCTR(text: string, password: string) {
  let decipher = crypto.createDecipher('aes-256-ctr', password);
  let dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function getCrc32(arr: Uint8Array) {
  let checkSum = CRC32.buf(arr);
  let checkSumInBytes = new Uint8Array(toBytesInt32(checkSum));
  let checkSumHex = stringUtils.byteArrayToHexString(checkSumInBytes);
  return checkSumHex;
}

export function toBytesInt32(num: number) {
  let arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
  let view = new DataView(arr);
  view.setInt32(0, num, false); // byteOffset = 0; litteEndian = false
  return arr;
}

export function generateKeyPair() {
  return ec.genKeyPair();
}

export function generatePrivateKey() {
  const keyPair = generateKeyPair();
  return keyPair.getPrivate('hex');
}

export function getKeyPairFromPrivate(privateKeyHex: string) {
  return ec.keyFromPrivate(privateKeyHex, 'hex');
}

export function getKeyPairFromPublic(publicKeyHex: string) {
  return ec.keyFromPublic(publicKeyHex, 'hex');
}

export function verifySignature(messageInBytes: Uint8Array, signature: Signature, publicKeyHex: string) {
  let keyPair = getKeyPairFromPublic(publicKeyHex);
  return keyPair.verify(messageInBytes, signature);
}

export function getPublicKeyFromHexString(publicKeyHex: string): PublicKey {
  if (!validatePublicKey(publicKeyHex)) throw new Error('Invalid public key');

  return { x: publicKeyHex.substr(0, 64), y: publicKeyHex.substr(64, 128) };
}

function validatePublicKey(publicKeyHex: string) {
  return (
    publicKeyHex !== null &&
    publicKeyHex !== undefined &&
    publicKeyHex.length === publicKeyLength &&
    regexp.test(publicKeyHex)
  );
}

export function verifyOrderOfPrivateKey(privateKeyHex: string) {
  return orderG.cmp(new BN(privateKeyHex, 16)) >= 0;
}

export function paddingPublicKeyByCoordinates(publicKeyX: string, publicKeyY: string) {
  return paddingPublicKey({ x: publicKeyX, y: publicKeyY });
}

export function paddingPublicKey(publicKey: PublicKey) {
  const paddingLetter = '0';
  let publicX = publicKey.x;
  let publicY = publicKey.y;

  if (publicKey.x.length < 64) {
    for (let i = publicKey.x.length; i < 64; i++) {
      publicX = paddingLetter + publicX;
    }
  }

  if (publicKey.y.length < 64) {
    for (let i = publicKey.y.length; i < 64; i++) {
      publicY = paddingLetter + publicY;
    }
  }
  return publicX + publicY;
}

export function signByteArrayMessage(byteArray: Uint8Array, keyPair: KeyPair) {
  return keyPair.sign(byteArray);
}

export function verifyAddressStructure(addressHex: string) {
  if (addressHex.length !== 136) return false;
  let addressHexWithoutCheckSum = addressHex.substring(0, 128);
  let checkSumHex = getCheckSumFromHexString(addressHexWithoutCheckSum);
  return checkSumHex === addressHex.substring(128, 136);
}

export function getCheckSumFromHexString(hexString: string) {
  let bytes = stringUtils.hexToBytes(hexString);
  bytes = removeLeadingZeroBytesFromAddress(bytes);
  return getCrc32(bytes);
}

function removeLeadingZeroBytesFromAddress(addressBytes: Uint8Array) {
  let xPart = addressBytes.subarray(0, addressBytes.byteLength / 2);
  let yPart = addressBytes.subarray(addressBytes.byteLength / 2, addressBytes.byteLength);

  xPart = stringUtils.removeZeroBytesFromByteArray(xPart);
  yPart = stringUtils.removeZeroBytesFromByteArray(yPart);

  let addressWithoutLeadingZeroBytes = new Uint8Array(xPart.byteLength + xPart.byteLength);
  addressWithoutLeadingZeroBytes.set(new Uint8Array(xPart), 0);
  addressWithoutLeadingZeroBytes.set(new Uint8Array(yPart), xPart.byteLength);
  return addressWithoutLeadingZeroBytes;
}
