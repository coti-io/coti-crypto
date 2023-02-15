import {
    decryptCTR,
    decryptGCM,
    encryptCTR,
    encryptGCM,
    generateKeyPair,
    generateKeyPairFromMnemonic,
    generateKeyPairFromSeed,
    generateMnemonic,
    generatePrivateKey,
    generateSeed,
    generateSeedFromMnemonic,
    getCrc32,
    getKeyPairFromPrivate,
    getPrivateKeyFromKeyPair, getPublicKeyByKeyPair, signByteArrayMessage, verifyOrderOfPrivateKey, verifySignature
} from './cryptoUtils';
import * as crypto from 'crypto';
import * as utils from './utils';

test('GCM Encryption', () => {
    const data = 'this is my password';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const encryptedPassword = encryptGCM(data, key, iv);
    const decryptedPassword = decryptGCM(encryptedPassword, key, iv);
    expect(decryptedPassword).toBe(data);
});
test('CTR Encryption', () => {
    const data = 'this is my password';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const encryptedPassword = encryptCTR(data, key, iv);
    const decryptedPassword = decryptCTR(encryptedPassword, key, iv);
    expect(decryptedPassword).toBe(data);
});

test('get crc 32', () => {
    const text = 'hello world';
    const byteArray = utils.getBytesFromString(text);
    const str = getCrc32(byteArray);
    expect(str).toBe( '0d4a1185');
});
test('generate key pair', () => {
    const keyPair = generateKeyPair();
    const signature = keyPair.sign('etay');
    const isVerified = keyPair.verify('etay', signature);
    expect(isVerified).toBe(true);
});
test('generate key pair from seed', () => {
    const seed = generateSeed('asdfgasdfgasdgadfhdsfhsdg');
    const res = generateKeyPairFromSeed(seed);
    expect(res).not.toBe(null);
});
test('generate private key', () => {
    const pk = generatePrivateKey();
    expect(pk).not.toBe(null);
});
test('generate private key from key pair', () => {
    const keyPair = generateKeyPair();
    const privateKey = getPrivateKeyFromKeyPair(keyPair);
    expect(privateKey).not.toBe(null);
});
test('generate private key from key pair and reverse and validate with public key', () => {
    const keyPair = generateKeyPair();
    const privateKey = getPrivateKeyFromKeyPair(keyPair);
    const newKeyPair = getKeyPairFromPrivate(privateKey);
    const publicKey = getPublicKeyByKeyPair(keyPair);
    const publicKey1 = getPublicKeyByKeyPair(newKeyPair);
    expect(publicKey).toBe(publicKey1);
});
test('verify signature', () => {
    const keyPair = generateKeyPair();
    const publicKey = getPublicKeyByKeyPair(keyPair);
    const message = 'this is message';
    const byteArray = utils.getBytesFromString(message);
    const signature = signByteArrayMessage(byteArray, keyPair);
    const isVerified = verifySignature(byteArray, signature, publicKey);
    expect(isVerified).toBe(true);
});
test('validate order of private key', () => {
    const keyPair = generateKeyPair();
    const privateKey = getPrivateKeyFromKeyPair(keyPair);
    const isVerified = verifyOrderOfPrivateKey(privateKey);
    expect(isVerified).toBe(true);
});



// test('remove trailing zeros', async () => {
//     const num = 12350000000;
//     const uIntArr =  new Uint8Array(num);
// });
// test('get checksum from address', async () => {
//
// });
