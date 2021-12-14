import * as crypto from 'crypto';
import BN from 'bn.js';
import * as CRC32 from 'crc-32';
import * as elliptic from 'elliptic';
import * as utils from './utils';
import { sha256 } from 'js-sha256';
import { sha3_256 as sha3Bit256, keccak256 } from 'js-sha3';
import { blake } from 'blakejs';
import { SignatureData } from '../signature';
import * as bip39 from 'bip39';
import utf8 from 'utf8';

const binascii = require('binascii');

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

export type EcSignature = elliptic.ec.Signature;
export type EcSignatureOptions = elliptic.ec.SignatureOptions;
export type KeyPair = elliptic.ec.KeyPair;

export function encryptGCM(data: string, password: string, iv: string): Encryption {
  let cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(password), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    content: encrypted,
    tag,
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
  let checkSumHex = utils.byteArrayToHexString(checkSumInBytes);
  return checkSumHex;
}

export function toBytesInt32(num: number) {
  let arr = new ArrayBuffer(4);
  let view = new DataView(arr);
  view.setInt32(0, num, false);
  return arr;
}

export function generateKeyPair() {
  return ec.genKeyPair();
}

export function generateKeyPairFromSeed(seed: string, index?: number) {
  let privateKeyInBytes = utils.hexToBytes(seed);
  if (index !== undefined) {
    if (!Number.isInteger(index)) throw new Error(`Index should be integer`);
    const indexInBytes = new Uint8Array(toBytesInt32(index));
    privateKeyInBytes = utils.concatByteArrays([privateKeyInBytes, indexInBytes]);
  }
  let privateKeyInHex;
  do {
    privateKeyInBytes = new Uint8Array(keccak256.update(privateKeyInBytes).array());
    privateKeyInHex = utils.byteArrayToHexString(privateKeyInBytes);
  } while (!verifyOrderOfPrivateKey(privateKeyInHex));
  return getKeyPairFromPrivate(privateKeyInHex);
}

export function generatePrivateKey() {
  const keyPair = generateKeyPair();
  return getPrivateKeyFromKeyPair(keyPair);
}

export function getPrivateKeyFromKeyPair(keyPair: KeyPair) {
  return keyPair.getPrivate('hex');
}

export function getKeyPairFromPrivate(privateKeyHex: string) {
  return ec.keyFromPrivate(privateKeyHex, 'hex');
}

export function getKeyPairFromPublic(publicKeyHex: string | { x: string; y: string }) {
  return ec.keyFromPublic(publicKeyHex, 'hex');
}

export function getKeyPairFromPublicHash(publicHash: string) {
  const pub = { x: publicHash.substr(0, 64), y: publicHash.substr(64, 128) };
  return getKeyPairFromPublic(pub);
}

export function verifySignature(messageInBytes: Uint8Array, signature: EcSignature | EcSignatureOptions, publicKeyHex: string) {
  let keyPair = getKeyPairFromPublic(publicKeyHex);
  return keyPair.verify(messageInBytes, signature);
}

export function signByteArrayMessage(byteArray: Uint8Array, keyPair: KeyPair): SignatureData {
  const ecSignature = keyPair.sign(byteArray);
  return { r: ecSignature.r.toString(16), s: ecSignature.s.toString(16) };
}

export function getPublicKeyFromHexString(publicKeyHex: string): PublicKey {
  if (!validatePublicKey(publicKeyHex)) throw new Error('Invalid public key');

  return { x: publicKeyHex.substr(0, 64), y: publicKeyHex.substr(64, 128) };
}

function validatePublicKey(publicKeyHex: string) {
  return publicKeyHex !== null && publicKeyHex !== undefined && publicKeyHex.length === publicKeyLength && regexp.test(publicKeyHex);
}

export function verifyOrderOfPrivateKey(privateKeyHex: string) {
  return orderG.cmp(new BN(privateKeyHex, 16)) >= 0;
}

export function getPublicKeyByKeyPair(keyPair: KeyPair) {
  let publicXKeyHex = keyPair.getPublic().getX().toString('hex');
  let publicYKeyHex = keyPair.getPublic().getY().toString('hex');

  return paddingPublicKeyByCoordinates(publicXKeyHex, publicYKeyHex);
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

export function verifyAddressStructure(addressHex: string) {
  if (addressHex.length !== 136) return false;
  let addressHexWithoutCheckSum = addressHex.substring(0, 128);
  let checkSumHex = getCheckSumFromAddressHex(addressHexWithoutCheckSum);
  return checkSumHex === addressHex.substring(128, 136);
}

export function getAddressHexByKeyPair(keyPair: KeyPair) {
  let paddedAddress = getPublicKeyByKeyPair(keyPair);
  let checkSumHex = getCheckSumFromAddressHex(paddedAddress);

  return paddedAddress + checkSumHex;
}

export function getCheckSumFromAddressHex(hexString: string) {
  let bytes = utils.hexToBytes(hexString);
  bytes = removeLeadingZeroBytesFromAddress(bytes);
  return getCrc32(bytes);
}

function removeLeadingZeroBytesFromAddress(addressBytes: Uint8Array) {
  let xPart = addressBytes.subarray(0, addressBytes.byteLength / 2);
  let yPart = addressBytes.subarray(addressBytes.byteLength / 2, addressBytes.byteLength);

  xPart = utils.removeZeroBytesFromByteArray(xPart);
  yPart = utils.removeZeroBytesFromByteArray(yPart);

  let addressWithoutLeadingZeroBytes = new Uint8Array(xPart.byteLength + yPart.byteLength);
  addressWithoutLeadingZeroBytes.set(new Uint8Array(xPart), 0);
  addressWithoutLeadingZeroBytes.set(new Uint8Array(yPart), xPart.byteLength);
  return addressWithoutLeadingZeroBytes;
}

export function generateSeed(key: string) {
  let sha2Array = sha256.array(key);
  let sha3Array = sha3Bit256.update(key).array();
  let combinedArray = sha2Array.concat(sha3Array);
  return blake.blake2bHex(Buffer.from(combinedArray), null, 32);
}

export function generateMnemonic() {
  return bip39.generateMnemonic();
}

export async function generateSeedFromMnemonic(mnemonic: string) {
  return await bip39.mnemonicToSeed(mnemonic).then(bytes => utils.byteArrayToHexString(bytes));
}

export async function generateKeyPairFromMnemonic(mnemonic: string, index?: number) {
  const seed = await generateSeedFromMnemonic(mnemonic);
  return generateKeyPairFromSeed(seed, index);
}

export function hashAndSign(privateKeyBytes: Uint8Array, message: string) {
  const keccakHash = keccak256.update(message);
  const digest = keccakHash.digest();
  const signinKey = ec.keyFromPrivate(privateKeyBytes);
  const sig = signinKey.sign(digest).toDER();
  const signHEX = utf8.decode(binascii.hexlify(sig.join()));
  
  return {
    r: signHEX.substring(0, 64),
    s: signHEX.substring(64, 128 )
  }
}
