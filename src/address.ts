import * as cryptoUtils from './utils/cryptoUtils';
import bigDecimal from 'js-big-decimal';

type KeyPair = cryptoUtils.KeyPair;

export class BaseAddress {
  protected addressHex: string;
  protected preBalance!: bigDecimal;
  protected balance!: bigDecimal;

  constructor(addressHex: string) {
    this.checkAddress(addressHex);
    this.addressHex = addressHex;
  }

  public checkAddress(addressHex: string) {
    cryptoUtils.verifyAddressStructure(addressHex);
  }

  public getAddressHex() {
    return this.addressHex;
  }

  public getPreBalance() {
    return this.preBalance;
  }

  public setPreBalance(preBalance: bigDecimal) {
    this.preBalance = preBalance;
  }

  public getBalance() {
    return this.balance;
  }

  public setBalance(balance: bigDecimal) {
    this.balance = balance;
  }
}

export class IndexedAddress extends BaseAddress {
  protected index: number;

  constructor(index: number, addressHex: string) {
    super(addressHex);
    this.index = index;
  }

  public getIndex() {
    return this.index;
  }
}

export class Address extends IndexedAddress {
  private keyPair: KeyPair;

  constructor(keyPair: KeyPair, index: number, addressHex?: string) {
    if (!addressHex) {
      let paddedAddress = cryptoUtils.getPublicKeyByKeyPair(keyPair);
      let checkSumHex = cryptoUtils.getCheckSumFromAddressHex(paddedAddress);

      addressHex = paddedAddress + checkSumHex;
    }
    super(index, addressHex);
    this.keyPair = keyPair;
  }

  public getAddressKeyPair() {
    return this.keyPair;
  }
}
