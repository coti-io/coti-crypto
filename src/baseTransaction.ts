import * as utils from './utils/utils';
import * as cryptoUtils from './utils/cryptoUtils';
import { keccak256 } from 'js-sha3';
import { BaseAddress } from './baseAddress';
import { SignatureData } from './signature';

export interface Item {
  itemId: number;
  itemPrice: number;
  itemName: string;
  itemQuantity: number;
}

export interface TrustScoreNodeResult {
  trustScoreNodeHash: string;
  trustScoreNodeSignature: SignatureData;
  valid: true;
}

export class BaseTransaction {
  private hash!: string;
  private addressHash: string;
  private amount: number;
  private createTime: number;
  private name: string;
  private items?: Item[];
  private encryptedMerchantName?: string;
  private originalAmount?: number;
  private networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  private rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  private receiverDescription?: string;
  private reducedAmount?: number;
  private signatureData?: SignatureData;

  constructor(
    address: BaseAddress,
    amount: number,
    name: string,
    items?: Item[],
    encryptedMerchantName?: string,
    originalAmount?: number
  ) {
    this.addressHash = address.getAddressHex();
    this.amount = amount;
    this.createTime = utils.getUtcInstant();
    this.name = name;
    if (name === 'RBT') {
      this.originalAmount = originalAmount;
    }

    if (name === 'PIBT') {
      this.items = items;
      this.encryptedMerchantName = encryptedMerchantName;
    }

    this.createBaseTransactionHash();
  }

  private createBaseTransactionHash() {
    let baseTxBytes = this.getBytes();
    let baseTxHashedArray = keccak256.update(baseTxBytes).array();
    this.hash = utils.byteArrayToHexString(new Uint8Array(baseTxHashedArray));
  }

  public getBytes() {
    let amountInBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.amount));
    let utcTime = this.createTime * 1000;
    let utcTimeInByteArray = utils.numberToByteArray(utcTime, 8);

    let bytes = utils.hexToBytes(this.addressHash);
    bytes = utils.concatByteArrays([bytes, amountInBytes, utcTimeInByteArray]);
    if (this.name === 'RBT' && this.originalAmount !== undefined) {
      let originalAmountInBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.originalAmount));
      bytes = utils.concatByteArrays([bytes, originalAmountInBytes]);
    }
    if (this.name === 'PIBT') {
      if (this.items !== undefined) {
        let itemsByteArray: number[] = [];
        this.items.forEach(item => {
          let id = Array.from(utils.numberToByteArray(item.itemId, 8));
          let price = utils.getArrayFromString(utils.removeZerosFromEndOfNumber(item.itemPrice));
          let name = utils.getArrayFromString(item.itemName);
          let quantity = Array.from(utils.numberToByteArray(item.itemQuantity, 4));
          itemsByteArray = itemsByteArray
            .concat(id)
            .concat(price)
            .concat(name)
            .concat(quantity);
        });
        bytes = utils.concatByteArrays([bytes, new Uint8Array(itemsByteArray)]);
      }
      if (this.encryptedMerchantName)
        bytes = utils.concatByteArrays([bytes, utils.getBytesFromString(this.encryptedMerchantName)]);
    }

    return bytes;
  }

  public getHashArray() {
    return utils.hexToArray(this.hash);
  }

  public sign(transactionHash: string, wallet) {
    if (this.shouldSignTransaction()) {
      const messageInBytes = utils.hexToBytes(transactionHash);
      this.signatureData = wallet.signMessage(messageInBytes, this.addressHash);
      return this.signatureData;
    }
  }

  private shouldSignTransaction() {
    return this.amount < 0;
  }

  public toJSON() {
    let jsonToReturn: any = {};

    jsonToReturn.addressHash = this.addressHash;
    jsonToReturn.amount = utils.removeZerosFromEndOfNumber(this.amount);
    jsonToReturn.hash = this.hash;
    jsonToReturn.createTime = this.createTime; //it gets the utc time

    if (this.signatureData) {
      jsonToReturn.signatureData = { r: this.signatureData.r, s: this.signatureData.s };
    }

    if (this.originalAmount) {
      jsonToReturn.originalAmount = utils.removeZerosFromEndOfNumber(this.originalAmount);
    }

    if (this.networkFeeTrustScoreNodeResult)
      jsonToReturn.networkFeeTrustScoreNodeResult = this.networkFeeTrustScoreNodeResult;
    if (this.encryptedMerchantName) jsonToReturn.encryptedMerchantName = this.encryptedMerchantName;
    if (this.items) jsonToReturn.items = this.items;
    if (this.rollingReserveTrustScoreNodeResult)
      jsonToReturn.rollingReserveTrustScoreNodeResult = this.rollingReserveTrustScoreNodeResult;
    if (this.receiverDescription) jsonToReturn.receiverDescription = this.receiverDescription;

    if (this.reducedAmount) jsonToReturn.reducedAmount = utils.removeZerosFromEndOfNumber(this.reducedAmount);

    jsonToReturn.name = this.name;

    return jsonToReturn;
  }
}
