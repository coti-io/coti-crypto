import * as utils from './utils/utils';
import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import { SignatureData, SigningType } from './signature';
import { IndexedWallet } from './wallet';
import BigDecimal = utils.BigDecimal;
import * as cryptoUtils from './utils/cryptoUtils';

type KeyPair = cryptoUtils.KeyPair;

export enum BaseTransactionName {
  INPUT = 'IBT',
  PAYMENT_INPUT = 'PIBT',
  FULL_NODE_FEE = 'FFBT',
  NETWORK_FEE = 'NFBT',
  ROLLING_RESERVE = 'RRBT',
  RECEIVER = 'RBT',
<<<<<<< HEAD
  GENERATE_TOKEN = 'TGBT',
  MINT_TOKEN_FEE = 'TMBT',
=======
>>>>>>> parent of dca328e... preparation for multi-dag
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

type BaseTransactionTime = 'createTime';

export interface BaseTransactionData {
  hash: string;
  addressHash: string;
  currencyHash?: string;
  amount: string;
  createTime: number;
  name: BaseTransactionName;
  items?: Item[];
  encryptedMerchantName?: string;
  serviceData?: any;
  originalAmount?: string;
  networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  reducedAmount?: string;
  receiverDescription?: string;
  signatureData: SignatureData;
  signerHash: string;
  originalCurrencyHash?: string;
}

export class BaseTransactionData {
  constructor(baseTransactionData: BaseTransactionData) {
    Object.assign(this, baseTransactionData);
    this.setTime('createTime', baseTransactionData.createTime);
  }

  public setTime(timeField: BaseTransactionTime, time: number | string) {
    if (typeof time === 'string') {
      this[timeField] = utils.utcStringToSeconds(time);
    } else {
      this[timeField] = time;
    }
  }
}

export class BaseTransaction {
  private hash!: string;
  private currencyHash?: string;
  private addressHash: string;
  private amount: BigDecimal;
  private createTime: number;
  private serviceData?: any
  private name: BaseTransactionName;
  private items?: Item[];
  private encryptedMerchantName?: string;
  private originalAmount?: BigDecimal;
  private networkFeeTrustScoreNodeResult?: TrustScoreNodeResult[];
  private rollingReserveTrustScoreNodeResult?: TrustScoreNodeResult[];
  private receiverDescription?: string;
  private reducedAmount?: BigDecimal;
  private signatureData?: SignatureData;
  private signerHash?: string;
  private originalCurrencyHash?: string;

  constructor(
    addressHash: string,
    amount: BigDecimal,
    name: BaseTransactionName,
    items?: Item[],
    encryptedMerchantName?: string,
    originalAmount?: BigDecimal,
    currencyHash?: string,
    hash?: string,
    createTime?: number,
    originalCurrencyHash?: string,
    serviceData?: any,
    signerHash?: string,
  ) {
    this.addressHash = addressHash;
    this.name = name;
    this.currencyHash = currencyHash;
    this.originalCurrencyHash = originalCurrencyHash;
    this.serviceData = serviceData;
    this.signerHash = signerHash;
    this.amount = amount.stripTrailingZeros();
    this.createTime = createTime? createTime: utils.utcNowToSeconds();

    if (name === BaseTransactionName.RECEIVER && originalAmount) {
      this.originalAmount = originalAmount.stripTrailingZeros();
    }

    if (name === BaseTransactionName.PAYMENT_INPUT) {
      this.items = items;
      this.encryptedMerchantName = encryptedMerchantName;
    }
    
    if(!hash){
      this.createBaseTransactionHash();
    } else {
      this.hash = hash;
    }
  }

  public getCurrencyHash(): string | undefined{
    return this.currencyHash;
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
    const bytesToMerge = [bytes, amountInBytes, utcTimeInByteArray]

    if(this.currencyHash){
      const currencyHashBytes = utils.hexToBytes(this.currencyHash);
      bytesToMerge.push(currencyHashBytes);
  }
    
    bytes = utils.concatByteArrays(bytesToMerge);
    if (this.name === BaseTransactionName.RECEIVER && this.originalAmount !== undefined) {
      let originalAmountInBytes = utils.getBytesFromString(this.originalAmount.stripTrailingZeros().toString());
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
          itemsByteArray = itemsByteArray.concat(id).concat(price).concat(name).concat(quantity);
        });
        bytes = utils.concatByteArrays([bytes, new Uint8Array(itemsByteArray)]);
      }
      if (this.encryptedMerchantName) bytes = utils.concatByteArrays([bytes, utils.getBytesFromString(this.encryptedMerchantName)]);
    }

    return bytes;
  }

  public getHashArray() {
    return utils.hexToArray(this.hash);
  }

  public static getBaseTransactionFromFeeData(feeData: BaseTransactionData) {
    let baseTransaction = new BaseTransaction(feeData.addressHash, new BigDecimal(feeData.amount), feeData.name);

    baseTransaction.createTime = feeData.createTime;
    if (feeData.originalAmount) {
      baseTransaction.originalAmount = new BigDecimal(feeData.originalAmount);
    }
    baseTransaction.hash = feeData.hash;
    if (feeData.reducedAmount) {
      baseTransaction.reducedAmount = new BigDecimal(feeData.reducedAmount);
    }
    if (feeData.name === BaseTransactionName.ROLLING_RESERVE) {
      baseTransaction.rollingReserveTrustScoreNodeResult = feeData.rollingReserveTrustScoreNodeResult;
    } else if (feeData.name === BaseTransactionName.NETWORK_FEE) {
      baseTransaction.networkFeeTrustScoreNodeResult = feeData.networkFeeTrustScoreNodeResult;
    } else if (feeData.name === BaseTransactionName.RECEIVER) {
      baseTransaction.receiverDescription = feeData.receiverDescription;
      baseTransaction.signatureData = feeData.signatureData;
<<<<<<< HEAD
    } else if ([BaseTransactionName.GENERATE_TOKEN, BaseTransactionName.MINT_TOKEN_FEE].includes(feeData.name)){
      baseTransaction.serviceData = feeData.serviceData;
      baseTransaction.signatureData = feeData.signatureData;
      baseTransaction.signerHash = feeData.signerHash;
=======
>>>>>>> parent of dca328e... preparation for multi-dag
    } else {
      baseTransaction.signatureData = feeData.signatureData;
    }

    baseTransaction.currencyHash = feeData.currencyHash;
    baseTransaction.originalCurrencyHash = feeData.originalCurrencyHash;

    return baseTransaction;
  }

  public async sign<T extends IndexedAddress>(transactionHash: string, wallet: IndexedWallet<T>) {
    if (this.isInput()) {
      const messageInBytes = this.getSignatureMessage(transactionHash);
      this.signatureData = await wallet.signMessage(messageInBytes, SigningType.BASE_TX, this.addressHash);
    }
  }

  public signWithKeyPair(transactionHash: string, keyPair: KeyPair) {
    if (this.isInput()) {
      const addressHex = cryptoUtils.getAddressHexByKeyPair(keyPair);
      if (addressHex !== this.addressHash) throw new Error('Wrong keyPair for base transaction address');
      const messageInBytes = this.getSignatureMessage(transactionHash);
      this.signatureData = cryptoUtils.signByteArrayMessage(messageInBytes, keyPair);
    }
  }

  public isInput() {
    return this.amount.isNegative();
  }

  private getSignatureMessage(transactionHash: string) {
    return utils.hexToBytes(transactionHash);
  }

  public toJSON() {
    let jsonToReturn = {
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
      signatureData: this.signatureData!,
      currencyHash: this.currencyHash? this.currencyHash: undefined,
      serviceData: this.serviceData? this.serviceData : undefined,
      signerHash: this.signerHash? this.signerHash : undefined
    };

    return jsonToReturn;
  }
}
