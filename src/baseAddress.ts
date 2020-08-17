import * as cryptoUtils from './utils/cryptoUtils';

export class BaseAddress {
  protected addressHex: string;
  protected preBalance?: number;
  protected balance?: number;

  constructor(addressHex: string) {
    this.checkAddress(addressHex);
    this.addressHex = addressHex;
  }

  checkAddress(addressHex: string) {
    cryptoUtils.verifyAddressStructure(addressHex);
  }

  public getAddressHex() {
    return this.addressHex;
  }

  public getPreBalance() {
    return this.preBalance;
  }

  public setPreBalance(preBalance: number) {
    this.preBalance = preBalance;
  }

  public getBalance() {
    return this.balance;
  }

  public setBalance(balance: number) {
    this.balance = balance;
  }
}
