import * as utils from './utils/utils';
import { BigDecimal } from './utils/utils';
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

  protected constructor(signatureData?: SignatureData) {
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
  private readonly amount: number;

  constructor(amount: number) {
    super();
    this.signingType = SigningType.FULL_NODE_FEE;
    this.amount = amount;
  }

  public getBytes() {
    return utils.getBytesFromString(new BigDecimal(this.amount).toPlainString());
  }
}

export class TransactionTrustScoreSignature extends Signature {
  private readonly transactionHash: string;

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

  protected constructor(creationTime: number, signature?: SignatureData) {
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

export class BridgeCreateRefundRequestSignature extends Signature {
  private readonly walletHash: string;
  private readonly swapUuid: string;

  constructor(swapUuid: string, walletHash: string, signature?: SignatureData) {
    super(signature);
    this.walletHash = walletHash;
    this.swapUuid = swapUuid;
  }

  public getBytes() {
    const walletHashInBytes = utils.hexToBytes(this.walletHash);
    const swapUuidInBytes = utils.getBytesFromString(this.swapUuid);
    return utils.concatByteArrays([walletHashInBytes, swapUuidInBytes]);
  }
}