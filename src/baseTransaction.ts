import * as utils from './utils/utils';
import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import { SignatureData } from './signature';
import { IndexedWallet } from './wallet';
import BigDecimal = utils.BigDecimal;

export enum BaseTransactionName {
  INPUT = 'IBT',
  PAYMENT_INPUT = 'PIBT',
  FULL_NODE_FEE = 'FFBT',
  NETWORK_FEE = 'NFBT',
  ROLLING_RESERVE = 'RRBT',
  RECEIVER = 'RBT'
}

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

export interface BaseTransactionObject {
  hash: string;
  addressHash: string;
  amount: string;
  createTime: number;
  name: BaseTransactionName;
  items?: Item[];
  encryptedMerchantName?: string;
  originalAmount?: string;
  networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  reducedAmount?: string;
  receiverDescription?: string;
  signatureData: SignatureData;
}

export class BaseTransaction {
  private hash!: string;
  private addressHash: string;
  private amount: BigDecimal;
  private createTime: number;
  private name: BaseTransactionName;
  private items?: Item[];
  private encryptedMerchantName?: string;
  private originalAmount?: BigDecimal;
  private networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  private rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  private receiverDescription?: string;
  private reducedAmount?: BigDecimal;
  private signatureData?: SignatureData;

  constructor(
    addressHash: string,
    amount: BigDecimal,
    name: BaseTransactionName,
    items?: Item[],
    encryptedMerchantName?: string,
    originalAmount?: BigDecimal
  ) {
    this.addressHash = addressHash;
    this.amount = amount.stripTrailingZeros();
    this.createTime = utils.getUtcInstant();
    this.name = name;
    if (name === BaseTransactionName.RECEIVER && originalAmount) {
      this.originalAmount = originalAmount.stripTrailingZeros();
    }

    if (name === BaseTransactionName.PAYMENT_INPUT) {
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
    let amountInBytes = utils.getBytesFromString(this.amount.stripTrailingZeros().toString());
    let utcTime = this.createTime * 1000;
    let utcTimeInByteArray = utils.numberToByteArray(utcTime, 8);

    let bytes = utils.hexToBytes(this.addressHash);
    bytes = utils.concatByteArrays([bytes, amountInBytes, utcTimeInByteArray]);
    if (this.name === BaseTransactionName.RECEIVER && this.originalAmount !== undefined) {
      let originalAmountInBytes = utils.getBytesFromString(this.amount.stripTrailingZeros().toString());
      bytes = utils.concatByteArrays([bytes, originalAmountInBytes]);
    }
    if (this.name === BaseTransactionName.PAYMENT_INPUT) {
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

  public static getBaseTransactionFromFeeObject(feeObject: BaseTransactionObject) {
    let baseTransaction = new BaseTransaction(feeObject.addressHash, new BigDecimal(feeObject.amount), feeObject.name);

    baseTransaction.createTime = feeObject.createTime;
    if (feeObject.originalAmount) {
      baseTransaction.originalAmount = new BigDecimal(feeObject.originalAmount);
    }
    baseTransaction.hash = feeObject.hash;
    if (feeObject.reducedAmount) {
      baseTransaction.reducedAmount = new BigDecimal(feeObject.reducedAmount);
    }
    if (feeObject.name === BaseTransactionName.ROLLING_RESERVE) {
      baseTransaction.rollingReserveTrustScoreNodeResult = feeObject.rollingReserveTrustScoreNodeResult;
    } else if (feeObject.name === BaseTransactionName.NETWORK_FEE) {
      baseTransaction.networkFeeTrustScoreNodeResult = feeObject.networkFeeTrustScoreNodeResult;
    } else if (feeObject.name === BaseTransactionName.RECEIVER) {
      baseTransaction.receiverDescription = feeObject.receiverDescription;
      baseTransaction.signatureData = feeObject.signatureData;
    } else {
      baseTransaction.signatureData = feeObject.signatureData;
    }

    return baseTransaction;
  }

  public async sign<T extends IndexedAddress>(transactionHash: string, wallet: IndexedWallet<T>) {
    if (this.shouldSignTransaction()) {
      const messageInBytes = utils.hexToBytes(transactionHash);
      this.signatureData = await wallet.signMessage(messageInBytes, this.addressHash);
    }
  }

  private shouldSignTransaction() {
    return this.amount.isNegative();
  }

  public toJSON() {
    let jsonToReturn: BaseTransactionObject = {
      hash: this.hash,
      addressHash: this.addressHash,
      amount: this.amount.toString(),
      createTime: this.createTime,
      name: this.name,
      originalAmount: this.originalAmount ? this.originalAmount.toString() : undefined,
      reducedAmount: this.reducedAmount ? this.reducedAmount.toString() : undefined,
      networkFeeTrustScoreNodeResult: this.networkFeeTrustScoreNodeResult,
      encryptedMerchantName: this.encryptedMerchantName,
      items: this.items,
      rollingReserveTrustScoreNodeResult: this.rollingReserveTrustScoreNodeResult,
      receiverDescription: this.receiverDescription,
      signatureData: this.signatureData!
    };

    return jsonToReturn;
  }
}
