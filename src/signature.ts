import * as utils from './utils/utils';
import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import { IndexedWallet } from './wallet';
import * as cryptoUtils from './utils/cryptoUtils';
import { EcSignatureOptions } from './utils/cryptoUtils';

type KeyPair = cryptoUtils.KeyPair;




export enum SigningType {
  MESSAGE = 'Message',
  FULL_NODE_FEE = 'FullNode Fee',
  TX_TRUST_SCORE = 'Transaction TrustScore',
  BASE_TX = 'BaseTransaction',
  Originator = 'Originator',
  TX = 'Transaction',
  TokenCurrencies = "TokenCurrencies",
  CurrencyTypeData = "CurrencyTypeData",
  TG_TX_TRUST_SCORE = 'TokenGeneration TrustScore',
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

  constructor(amount: number) {
    super();
    this.signingType = SigningType.FULL_NODE_FEE;
    this.amount = amount;
  }

  public getBytes() {
    return utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.amount));
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

export class ClaimReward extends Signature {
  private creationTime: number;

  constructor(creationTime: number) {
    super();
    this.creationTime = creationTime;
  }

  public getBytes() {
    return utils.numberToByteArray(this.creationTime, 8);
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
    this.signingType = SigningType.Originator;
    this.currencyName = currencyName;
    this.currencySymbol= currencySymbol;
    this.description = description;
    this.totalSupply = totalSupply;
    this.scale = scale;
  }

  public getBytes() {
    const message = `${utf8.encode(this.currencyName)}${utf8.encode(this.currencySymbol)}${utf8.encode(this.description)}${utf8.encode(this.totalSupply.toString())}`;
    const arraysToMerge = [utils.getBytesFromString(message), utils.numberToByteArray(this.scale, 4)]

    return utils.concatByteArrays(arraysToMerge);
  }
}

export class CurrencyTypeDataSignature extends Signature {
  private currencySymbol: string;
  private currencyType: string;
  private currencyRateSourceType: string;
  private rateSource: string;
  private protectionModel: string;
  private instantTime: number

  constructor(currencySymbol: string, currencyType: string, currencyRateSourceType: string, rateSource: string, protectionModel: string, instantTime: number) {
    super();
    this.signingType = SigningType.CurrencyTypeData;
    this.currencySymbol = currencySymbol;
    this.currencyType= currencyType;
    this.currencyRateSourceType = currencyRateSourceType;
    this.rateSource = rateSource;
    this.protectionModel = protectionModel;
    this.instantTime = instantTime;
  }

  public getBytes() {
    const message = `${utf8.encode(this.currencySymbol)}${utf8.encode(this.currencyType)}${utf8.encode(this.currencyRateSourceType)}${utf8.encode(this.rateSource)}${utf8.encode(this.protectionModel)}`;
    const arraysToMerge = [utils.getBytesFromString(message), utils.numberToByteArray(this.instantTime, 8)];

    return utils.concatByteArrays(arraysToMerge);
  }
}

export class TokenCurrenciesSignature extends Signature {
  private userHash: string;

  constructor(userHash: string) {
    super();
    this.userHash = userHash;
    this.signingType = SigningType.TokenCurrencies;
  }

  public getBytes() {
    return utils.hexToBytes(this.userHash);
  }
}

export class TreasuryCreateDepositSignature extends Signature {
  private readonly leverage: number;
  private readonly locking: number;
  private readonly timestamp: number;

  constructor(leverage: number, locking: number, timestamp: number, signature?: SignatureData ) {
    super(signature);
    this.leverage = leverage;
    this.locking = locking;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const leverageBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.leverage));
    const lockingBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.locking));
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([leverageBytes, lockingBytes, timestampBytes]);
  }
}

export class TreasuryGetDepositSignature extends Signature {
  private readonly uuid: string;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, signature?: SignatureData ) {
    super(signature);
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountBalanceSignature extends Signature {
  private readonly walletHash: string;
  private readonly timestamp: number;

  constructor(walletHash: string, timestamp: number, signature?: SignatureData ) {
    super(signature);
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountSignature extends Signature {
  private readonly walletHash: string;
  private readonly timestamp: number;

  constructor(walletHash: string, timestamp: number, signature?: SignatureData ) {
    super(signature);
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryRenewLockSignature extends Signature {
  private readonly uuid: string;
  private readonly lockDays: number;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, lockDays: number, signature?: SignatureData ) {
    super(signature);
    this.uuid = uuid;
    this.lockDays = lockDays;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const lockDaysBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.lockDays));
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([uuidBytes, lockDaysBytes, timestampBytes]);
  }
}

export class TreasuryDeleteLockSignature extends Signature {
  private readonly uuid: string;
  private readonly timestamp: number;

  constructor(uuid: string, timestamp: number, signature?: SignatureData ) {
    super(signature);
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalEstimationSignature extends Signature {
  private readonly rewardAmount: number;
  private readonly depositAmount: number;
  private readonly depositUuid: string;
  private readonly timestamp: number;

  constructor(rewardAmount: number, depositAmount: number, depositUuid: string, timestamp: number, signature?: SignatureData ) {
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
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalSignature extends Signature {
  private readonly rewardAmount: number;
  private readonly depositAmount: number;
  private readonly depositUuid: string;
  private readonly timestamp: number;

  constructor(rewardAmount: number, depositAmount: number, depositUuid: string, timestamp: number, signature?: SignatureData ) {
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
    const timestampBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.timestamp));
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, timestampBytes]);
  }
}
