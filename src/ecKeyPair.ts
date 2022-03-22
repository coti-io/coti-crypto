import * as cryptoUtils from './utils/cryptoUtils';
import { KeyPair } from './utils/cryptoUtils';

export class EcKeyPair {
  readonly keyPair: KeyPair;
  readonly index?: number;

  constructor(seed: string, index?: number) {
    this.index = index;
    this.keyPair = cryptoUtils.generateKeyPairFromSeed(seed, index);
  }

  public toAddress() {
    if (this.index === undefined) throw new Error('Not generating an address');
    return cryptoUtils.getAddressHexByKeyPair(this.keyPair);
  }

  public getPrivateKey() {
    return cryptoUtils.getPrivateKeyFromKeyPair(this.keyPair);
  }

  public getPublicKey() {
    return this.index === undefined ? cryptoUtils.getPublicKeyByKeyPair(this.keyPair) : this.toAddress();
  }
}

export class PrivateKey {
  readonly keyPair: KeyPair;

  constructor(privateKeyHex: string) {
    this.keyPair = cryptoUtils.getKeyPairFromPrivate(privateKeyHex);
  }

  public getPublicKey() {
    return cryptoUtils.getPublicKeyByKeyPair(this.keyPair);
  }
}
