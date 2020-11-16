import * as cryptoUtils from './utils/cryptoUtils';
import { BigDecimal } from './utils/utils';

type KeyPair = cryptoUtils.KeyPair;

export class BaseAddress {
  protected addressHex: string;
  protected preBalance!: BigDecimal;
  protected balance!: BigDecimal;

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

  public setPreBalance(preBalance: BigDecimal) {
    this.preBalance = preBalance;
  }

  public getBalance() {
    return this.balance;
  }

  public setBalance(balance: BigDecimal) {
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
      addressHex = cryptoUtils.getAddressHexByKeyPair(keyPair);
    }

    super(index, addressHex);
    this.keyPair = keyPair;
  }

  public getAddressKeyPair() {
    return this.keyPair;
  }
}
