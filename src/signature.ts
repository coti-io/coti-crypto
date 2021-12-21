import * as utils from './utils/utils';
import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import { IndexedWallet } from './wallet';
import * as cryptoUtils from './utils/cryptoUtils';
import { EcSignature } from './utils/cryptoUtils';

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

export interface SignatureData {
  r: string;
  s: string;
}

export abstract class Signature {
  protected signingType!: SigningType;
  protected signatureData!: SignatureData;

  constructor() {}

  public async sign<T extends IndexedAddress>(wallet: IndexedWallet<T>, isHash = false) {
    const messageInBytes = this.getSignatureMessage(isHash);
    this.signatureData = await wallet.signMessage(messageInBytes, this.signingType);
    return this.signatureData;
  }

  public async verify(walletHash: string, signature: EcSignature) {
    const hashedBytesArray = this.createBasicSignatureHash();
    return cryptoUtils.verifySignature(hashedBytesArray, signature, walletHash);
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

export class TreasuryCreateDepositSignature extends Signature {
  private creationTime: number;
  private leverage: number;
  private locking: number;
  private timestamp: number;

  constructor(creationTime: number, leverage: number, locking: number, timestamp: number) {
    super();
    this.creationTime = creationTime;
    this.leverage = leverage;
    this.locking = locking;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const leverageBytes = utils.getBytesFromString(this.leverage.toString());
    const lockingBytes = utils.getBytesFromString(this.locking.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([leverageBytes, lockingBytes, timestampBytes]);
  }
}

export class TreasuryGetDepositSignature extends Signature {
  private uuid: number;
  private timestamp: number;

  constructor(uuid: number, timestamp: number) {
    super();
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountBalanceSignature extends Signature {
  private walletHash: string;
  private timestamp: number;

  constructor(walletHash: string, timestamp: number) {
    super();
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryGetAccountSignature extends Signature {
  private walletHash: string;
  private timestamp: number;

  constructor(walletHash: string, timestamp: number) {
    super();
    this.walletHash = walletHash;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const walletHashBytes = utils.getBytesFromString(this.walletHash.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([walletHashBytes, timestampBytes]);
  }
}

export class TreasuryRenewLockSignature extends Signature {
  private uuid: number;
  private lockDays: number;
  private timestamp: number;

  constructor(uuid: number, timestamp: number, lockDays: number) {
    super();
    this.uuid = uuid;
    this.lockDays = lockDays;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const lockDaysBytes = utils.getBytesFromString(Number(this.lockDays).toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([uuidBytes, lockDaysBytes, timestampBytes]);
  }
}

export class TreasuryDeleteLockSignature extends Signature {
  private uuid: number;
  private timestamp: number;

  constructor(uuid: number, timestamp: number) {
    super();
    this.uuid = uuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const uuidBytes = utils.getBytesFromString(this.uuid.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([uuidBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalEstimationSignature extends Signature {
  private rewardAmount: number;
  private depositAmount: number;
  private depositUuid: string;
  private timestamp: number;

  constructor(rewardAmount: number, depositAmount: number, depositUuid: string, timestamp: number) {
    super();
    this.rewardAmount = rewardAmount;
    this.depositAmount = depositAmount;
    this.depositUuid = depositUuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const rewardAmountBytes = utils.getBytesFromString(Number(this.rewardAmount).toString());
    const depositAmountBytes = utils.getBytesFromString(Number(this.depositAmount).toString());
    const uuidHashBytes = utils.getBytesFromString(this.depositUuid.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, timestampBytes]);
  }
}

export class TreasuryWithdrawalSignature extends Signature {
  private rewardAmount: number;
  private depositAmount: number;
  private depositUuid: string;
  private timestamp: number;

  constructor(rewardAmount: number, depositAmount: number, depositUuid: string, timestamp: number) {
    super();
    this.rewardAmount = rewardAmount;
    this.depositAmount = depositAmount;
    this.depositUuid = depositUuid;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const rewardAmountBytes = utils.getBytesFromString(Number(this.rewardAmount).toString());
    const depositAmountBytes = utils.getBytesFromString(Number(this.depositAmount).toString());
    const uuidHashBytes = utils.getBytesFromString(this.depositUuid.toString());
    const timestampBytes = utils.numberToByteArray(this.timestamp, 8);
    return utils.concatByteArrays([rewardAmountBytes, depositAmountBytes, uuidHashBytes, timestampBytes]);
  }
}

