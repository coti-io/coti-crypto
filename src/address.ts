import * as cryptoUtils from './utils/cryptoUtils';
import { BigDecimal } from './utils/utils';
import { ec } from 'elliptic';

type KeyPair = cryptoUtils.KeyPair;

export class BaseAddress {
  protected addressHex: string;
  protected preBalance: BigDecimal = new BigDecimal('0');
  protected balance: BigDecimal = new BigDecimal('0');

  constructor(addressHex: string) {
    this.checkAddress(addressHex);
    this.addressHex = addressHex;
  }

  public checkAddress(addressHex: string): void {
    cryptoUtils.verifyAddressStructure(addressHex);
  }

  public getAddressHex(): string {
    return this.addressHex;
  }

  public getPreBalance(): BigDecimal {
    return this.preBalance;
  }

  public setPreBalance(preBalance: BigDecimal): void {
    this.preBalance = preBalance;
  }

  public getBalance(): BigDecimal {
    return this.balance;
  }

  public setBalance(balance: BigDecimal): void {
    this.balance = balance;
  }
}

export class IndexedAddress extends BaseAddress {
  protected index: number;

  constructor(index: number, addressHex: string) {
    super(addressHex);
    this.index = index;
  }

  public getIndex(): number {
    return this.index;
  }
}

export class Address extends IndexedAddress {
  private readonly keyPair: KeyPair;

  constructor(keyPair: KeyPair, index: number, addressHex?: string) {
    if (!addressHex) {
      addressHex = cryptoUtils.getAddressHexByKeyPair(keyPair);
    }

    super(index, addressHex);
    this.keyPair = keyPair;
  }

  public getAddressKeyPair(): ec.KeyPair {
    return this.keyPair;
  }
}

export class LedgerAddress extends IndexedAddress {
  constructor(index: number, ledgerPublicKey?: string, addressHex?: string) {
    if (ledgerPublicKey) {
      const keyPair = cryptoUtils.getKeyPairFromPublic(ledgerPublicKey);
      const ledgerAddressHex = cryptoUtils.getAddressHexByKeyPair(keyPair);
      if (addressHex && ledgerAddressHex !== addressHex) throw new Error(`Wrong addressHex inserted`);
      addressHex = ledgerAddressHex;
    } else if (!addressHex) throw new Error(`Address hex should be inserted`);
    super(index, addressHex);
  }
}
