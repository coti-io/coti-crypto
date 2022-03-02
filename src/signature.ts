import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import * as cryptoUtils from './utils/cryptoUtils';
import { EcSignatureOptions } from './utils/cryptoUtils';
import * as utils from './utils/utils';
import { IndexedWallet } from './wallet';

type KeyPair = cryptoUtils.KeyPair;

export enum SigningType {
  MESSAGE = 'Message',
  FULL_NODE_FEE = 'FullNode Fee',
  TX_TRUST_SCORE = 'Transaction TrustScore',
  BASE_TX = 'BaseTransaction',
  TX = 'Transaction',
}

export type SigningTypeKey = keyof typeof SigningType;

export const signingTypeKeyMap = new Map<SigningType, SigningTypeKey>(
  Object.entries(SigningType).map(([keyString, value]: [string, SigningType]) => [value, keyString as keyof typeof SigningType])
);

export type SignatureData = EcSignatureOptions;

export abstract class Signature {
  protected signingType!: SigningType;
  protected signatureData!: SignatureData;

  constructor(signatureData?: SignatureData) {
    if (signatureData) {
      this.signatureData = signatureData;
    }
  }

  public async sign<T extends IndexedAddress>(wallet: IndexedWallet<T>, isHash = false) {
    const messageInBytes = this.getSignatureMessage(isHash);
    this.signatureData = await wallet.signMessage(messageInBytes, this.signingType);
    return this.signatureData;
  }

  public verify(walletHash: string, isHash = false) {
    const messageInBytes = this.getSignatureMessage(isHash);
    return cryptoUtils.verifySignature(messageInBytes, this.signatureData, walletHash);
  }

  public createBasicSignatureHash() {
    let messageInBytes = this.getBytes();
    let messageHashedArray = keccak256.update(messageInBytes).array();
    return new Uint8Array(messageHashedArray);
  }

  public signByKeyPair(keyPair: KeyPair, isHash = false) {
    const messageInBytes = this.getSignatureMessage(isHash);
    this.signatureData = cryptoUtils.signByteArrayMessage(messageInBytes, keyPair);
    return this.signatureData;
  }

  private getSignatureMessage(isHash: boolean) {
    return isHash ? this.getBytes() : this.createBasicSignatureHash();
  }

  abstract getBytes(): Uint8Array;
}

export class FullNodeFeeSignature extends Signature {
  private amount: number;
  private originalCurrencyHash?: string;

  constructor(amount: number, originalCurrencyHash?: string) {
    super();
    this.signingType = SigningType.FULL_NODE_FEE;
    this.amount = amount;
    this.originalCurrencyHash = originalCurrencyHash;
  }

  public getBytes() {
    const byteArraysToMerge = [];
    const amountPlainString = new utils.BigDecimal(this.amount).toPlainString();
    const amountBytes = utils.getBytesFromString(amountPlainString);

    if (this.originalCurrencyHash) {
      byteArraysToMerge.push(utils.hexToBytes(this.originalCurrencyHash));
    }

    byteArraysToMerge.push(amountBytes);

    return utils.concatByteArrays(byteArraysToMerge);
  }
}

export class TransactionTrustScoreSignature extends Signature {
  private transactionHash: string;

  constructor(transactionHash: string) {
    super();
    this.signingType = SigningType.TX_TRUST_SCORE;
    this.transactionHash = transactionHash;
  }

  public getBytes() {
    return utils.hexToBytes(this.transactionHash);
  }
}

abstract class CreationTimeSignature extends Signature {
  protected creationTime: number;

  constructor(creationTime: number, signature?: SignatureData) {
    super(signature);
    this.creationTime = creationTime;
  }

  public getBytes() {
    return utils.numberToByteArray(this.creationTime, 8);
  }
}

export class ClaimRewardSignature extends CreationTimeSignature {
  constructor(creationTime: number, signature?: SignatureData) {
    super(creationTime, signature);
  }
}

export class ClaimStakeRewardSignature extends CreationTimeSignature {
  constructor(creationTime: number, signature?: SignatureData) {
    super(creationTime, signature);
  }
}

export class UnstakeSignature extends CreationTimeSignature {
  constructor(creationTime: number, signature?: SignatureData) {
    super(creationTime, signature);
  }
}

export class OriginatorSignature extends Signature {
  private currencyName: string;
  private currencySymbol: string;
  private description: string;
  private totalSupply: number;
  private scale: number;

  constructor(currencyName: string, currencySymbol: string, description: string, totalSupply: number, scale: number) {
    super();

    this.signingType = SigningType.MESSAGE;
    this.currencyName = currencyName;
    this.currencySymbol = currencySymbol;
    this.description = description;
    this.totalSupply = totalSupply;
    this.scale = scale;
  }

  public getBytes() {
    const message = `${this.currencyName}${this.currencySymbol}${this.description}${this.totalSupply.toString()}`;
    const arraysToMerge = [utils.getBytesFromString(message), utils.numberToByteArray(this.scale, 4)];

    return utils.concatByteArrays(arraysToMerge);
  }
}

export class CurrencyTypeDataSignature extends Signature {
  private currencySymbol: string;
  private currencyType: string;
  private currencyRateSourceType: string;
  private rateSource: string;
  private protectionModel: string;
  private instantTime: number;

  constructor(
    currencySymbol: string,
    currencyType: string,
    currencyRateSourceType: string,
    rateSource: string,
    protectionModel: string,
    instantTime: number
  ) {
    super();

    this.signingType = SigningType.MESSAGE;
    this.currencySymbol = currencySymbol;
    this.currencyType = currencyType;
    this.currencyRateSourceType = currencyRateSourceType;
    this.rateSource = rateSource;
    this.protectionModel = protectionModel;
    this.instantTime = instantTime;
  }

  public getBytes() {
    const message = `${this.currencySymbol}${this.currencyType}${this.currencyRateSourceType}${this.rateSource}${this.protectionModel}`;
    const arraysToMerge = [utils.getBytesFromString(message), utils.numberToByteArray(this.instantTime, 8)];

    return utils.concatByteArrays(arraysToMerge);
  }
}

export class TokenCurrenciesSignature extends Signature {
  private userHash: string;
  private instantTime: number;

  constructor(userHash: string, instantTime: number) {
    super();

    this.userHash = userHash;
    this.instantTime = instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes() {
    const userHashBytes = utils.hexToBytes(this.userHash);
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);

    return utils.concatByteArrays([userHashBytes, instantTimeBytes]);
  }
}

export class MintQuoteSignature extends Signature {
  private currencyHash: string;
  private mintingAmount: number;
  private instantTime: number;

  constructor(currencyHash: string, mintingAmount: number, instantTime: number) {
    super();

    this.currencyHash = currencyHash;
    this.mintingAmount = mintingAmount;
    this.instantTime = instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes() {
    const currencyHashBytes = utils.hexToBytes(this.currencyHash);
    const mintingAmountBytes = utils.getBytesFromString(this.mintingAmount.toString());
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);
    const byteArraysToMerge = [currencyHashBytes, mintingAmountBytes, instantTimeBytes];

    return utils.concatByteArrays(byteArraysToMerge);
  }
}

export class MintQuoteDataSignature extends Signature {
  private currencyHash: string;
  private mintingAmount: number;
  private feeAmount: number;
  private receiverAddress: string;
  private instantTime: number;

  constructor(currencyHash: string, mintingAmount: number, feeAmount: number, receiverAddress: string, instantTime: number) {
    super();

    this.currencyHash = currencyHash;
    this.mintingAmount = mintingAmount;
    this.feeAmount = feeAmount;
    this.receiverAddress = receiverAddress;
    this.instantTime = instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes() {
    const currencyHashBytes = utils.hexToBytes(this.currencyHash);
    const mintingAmountBytes = utils.getBytesFromString(this.mintingAmount.toString());
    const feeAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.feeAmount).toString());
    const receiverAddressBytes = utils.hexToBytes(this.receiverAddress);
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);
    const byteArraysToMerge = [currencyHashBytes, mintingAmountBytes, feeAmountBytes, receiverAddressBytes, instantTimeBytes];

    return utils.concatByteArrays(byteArraysToMerge);
  }
}

export class MintQuoteFeeSignature extends Signature {
  private currencyHash: string;
  private mintingAmount: number;
  private feeAmount: number;
  private instantTime: number;

  constructor(instantTime: number, currencyHash: string, mintingAmount: number, feeAmount: number) {
    super();

    this.currencyHash = currencyHash;
    this.mintingAmount = mintingAmount;
    this.feeAmount = feeAmount;
    this.instantTime = instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes() {
    const currencyHashBytes = utils.hexToBytes(this.currencyHash);
    const mintingAmountBytes = utils.getBytesFromString(this.mintingAmount.toString());
    const feeAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.feeAmount).toString());
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);
    const byteArraysToMerge = [instantTimeBytes, currencyHashBytes, mintingAmountBytes, feeAmountBytes];

    return utils.concatByteArrays(byteArraysToMerge);
  }
}
export class TreasuryCreateDepositSignature extends Signature {
  private readonly leverage: number;
  private readonly locking: number;
  private readonly nextLock: number;
  private readonly timestamp: number;

  constructor(leverage: number, locking: number, nextLock: number, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.leverage = leverage;
    this.locking = locking;
    this.nextLock = nextLock;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const leverageBytes = utils.numberToByteArray(this.leverage, 1);
    const lockingBytes = utils.numberToByteArray(this.locking, 2);
    const nextLockBytes = utils.numberToByteArray(this.nextLock, 2);
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([leverageBytes, lockingBytes, nextLockBytes, timestampBytes]);
  }
}

export class TreasuryGetDepositSignature extends Signature {
  private readonly uuid: string;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountBalanceSignature extends Signature {
  private readonly walletHash: string;
  private readonly timestamp: number;

  constructor(walletHash: string, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountSignature extends Signature {
  private readonly walletHash: string;
  private readonly timestamp: number;

  constructor(walletHash: string, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryRenewLockSignature extends Signature {
  private readonly uuid: string;
  private readonly lockDays: number;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, lockDays: number, signature?: SignatureData) {
    super(signature);
    this.uuid = uuid;
    this.lockDays = lockDays;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const lockDaysBytes = utils.numberToByteArray(this.lockDays, 2);
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([uuidBytes, lockDaysBytes, timestampBytes]);
  }
}

export class TreasuryDeleteLockSignature extends Signature {
  private readonly uuid: string;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalEstimationSignature extends Signature {
  private readonly rewardAmount: number;
  private readonly depositAmount: number;
  private readonly depositUuid: string;
  private readonly timestamp: number;

  constructor(rewardAmount: number, depositAmount: number, depositUuid: string, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.rewardAmount = rewardAmount;
    this.depositAmount = depositAmount;
    this.depositUuid = depositUuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const rewardAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.rewardAmount));
    const depositAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.depositAmount));
    const uuidHashBytes = utils.getBytesFromString(this.depositUuid.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalSignature extends Signature {
  private readonly rewardAmount: number;
  private readonly depositAmount: number;
  private readonly depositUuid: string;
  private readonly destinationAddress: string;
  private readonly timestamp: number;

  constructor(
    rewardAmount: number,
    depositAmount: number,
    depositUuid: string,
    destinationAddress: string,
    timestamp: number,
    signature?: SignatureData
  ) {
    super(signature);
    this.rewardAmount = rewardAmount;
    this.depositAmount = depositAmount;
    this.depositUuid = depositUuid;
    this.destinationAddress = destinationAddress;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const rewardAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.rewardAmount));
    const depositAmountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.depositAmount));
    const uuidHashBytes = utils.getBytesFromString(this.depositUuid.toString());
    const destinationAddressHashBytes = utils.getBytesFromString(this.destinationAddress.toString());
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, destinationAddressHashBytes, timestampBytes]);
  }
}

export class TokenDetailsSignature extends Signature {
  private userHash: string;
  private currencyHash?: string;
  private currencySymbol?: string;
  private instantTime: number;

  constructor(params: { userHash: string; instantTime: number; currencyHash?: string; currencySymbol?: string }) {
    super();

    this.userHash = params.userHash;
    this.currencyHash = params.currencyHash;
    this.currencySymbol = params.currencySymbol;
    this.instantTime = params.instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes() {
    const userHashBytes = utils.hexToBytes(this.userHash);
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);
    const bytesToMerge = [userHashBytes];

    if (this.currencyHash) {
      const currencyHashBytes = utils.hexToBytes(this.currencyHash);
      bytesToMerge.push(currencyHashBytes);
    } else if (this.currencySymbol) {
      const currencySymbolBytes = utils.getBytesFromString(this.currencySymbol);
      bytesToMerge.push(currencySymbolBytes);
    }

    bytesToMerge.push(instantTimeBytes);

    return utils.concatByteArrays(bytesToMerge);
  }
}
