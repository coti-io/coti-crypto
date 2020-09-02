import {
  KeyPair,
  getCheckSumFromAddressHex,
  paddingPublicKeyByCoordinates,
  verifyAddressStructure
} from './utils/cryptoUtils';
import bigDecimal from 'js-big-decimal';

export class BaseAddress {
  protected addressHex!: string;
  protected preBalance!: bigDecimal;
  protected balance!: bigDecimal;

  constructor(addressHex: string) {
    this.checkAddress(addressHex);
    this.addressHex = addressHex;
  }

  public checkAddress(addressHex: string) {
    verifyAddressStructure(addressHex);
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

  constructor(addressHex: string, index: number) {
    super(addressHex);
    this.index = index;
  }

  public getIndex() {
    return this.index;
  }
}

export class Address extends IndexedAddress {
  private keyPair: KeyPair;

  constructor(keyPair: KeyPair, index: number) {
    let publicXKeyHex = keyPair
      .getPublic()
      .getX()
      .toString(16, 2);
    let publicYKeyHex = keyPair
      .getPublic()
      .getY()
      .toString(16, 2);

    let paddedAddress = paddingPublicKeyByCoordinates(publicXKeyHex, publicYKeyHex);
    let checkSumHex = getCheckSumFromAddressHex(paddedAddress);

    let addressWithCheckSum = paddedAddress + checkSumHex;
    super(addressWithCheckSum, index);

    this.keyPair = keyPair;
  }

  public getAddressKeyPair() {
    return this.keyPair;
  }
}
