import * as utils from './utils/utils';
import * as cryptoUtils from './utils/cryptoUtils';
import { keccak256 } from 'js-sha3';

export interface SignatureData {
  r: string;
  s: string;
}

export abstract class Signature {
  protected signatureData: SignatureData;

  constructor() {}

  public sign(Wallet, isHash: boolean) {
    const messageInBytes = isHash ? this.getBytes() : this.createBasicSignatureHash();
    this.signatureData = Wallet.signMessage(messageInBytes);
    return this.signatureData;
  }

  public createBasicSignatureHash() {
    let baseTxBytes = this.getBytes();
    let baseTxHashedArray = keccak256.update(baseTxBytes).array();
    return new Uint8Array(baseTxHashedArray);
  }

  abstract getBytes(): Uint8Array;
}

export class FullNodeFeeSignatue extends Signature {
  private amount: number;

  constructor(amount: number) {
    super();
    this.amount = amount;
  }

  getBytes() {
    let arr: number[] = [];
    const amountInBytes = utils.getNumberArrayFromString(utils.removeZerosFromEndOfNumber(this.amount));
    arr = arr.concat(amountInBytes);
    return new Uint8Array(arr);
  }
}
