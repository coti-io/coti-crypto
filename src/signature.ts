import { keccak256 } from 'js-sha3';
import { IndexedAddress } from './address';
import * as cryptoUtils from './utils/cryptoUtils';
import { EcSignatureOptions } from './utils/cryptoUtils';
import * as utils from './utils/utils';
import { IndexedWallet } from './wallet';
import {getBytesFromArrayOfStrings} from './utils/utils';

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
  private amount: string;
  private currencyHash?: string;

  constructor(amount: string, currencyHash?: string) {
    super();
    this.signingType = SigningType.FULL_NODE_FEE;
    this.amount = amount;
    this.currencyHash = currencyHash;
  }

  public getBytes(): Uint8Array {
    const byteArraysToMerge = [];
    const amountPlainString = new utils.BigDecimal(this.amount).toPlainString();
    const amountBytes = utils.getBytesFromString(amountPlainString);

    if (this.currencyHash) {
      byteArraysToMerge.push(utils.hexToBytes(this.currencyHash));
    }

    byteArraysToMerge.push(amountBytes);

    return utils.concatByteArrays(byteArraysToMerge);
  }
}

export class TransactionTrustScoreSignature extends Signature {
  private readonly transactionHash: string;

  constructor(transactionHash: string) {
    super();
    this.signingType = SigningType.TX_TRUST_SCORE;
    this.transactionHash = transactionHash;
  }

  public getBytes(): Uint8Array {
    return utils.hexToBytes(this.transactionHash);
  }
}

abstract class CreationTimeSignature extends Signature {
  protected creationTime: number;

  protected constructor(creationTime: number, signature?: SignatureData) {
    super(signature);
    this.creationTime = creationTime;
  }

  public getBytes(): Uint8Array {
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
  private totalSupply: string;
  private scale: number;

  constructor(currencyName: string, currencySymbol: string, description: string, totalSupply: string, scale: number) {
    super();

    this.signingType = SigningType.MESSAGE;
    this.currencyName = currencyName;
    this.currencySymbol = currencySymbol;
    this.description = description;
    this.totalSupply = totalSupply;
    this.scale = scale;
  }

  public getBytes(): Uint8Array {
    const message = `${this.currencyName}${this.currencySymbol}${this.description}${this.totalSupply}`;
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
    const userHashBytes = utils.hexToBytes(this.userHash);
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);

    return utils.concatByteArrays([userHashBytes, instantTimeBytes]);
  }
}

export class MintQuoteSignature extends Signature {
  private currencyHash: string;
  private mintingAmount: string;
  private instantTime: number;

  constructor(currencyHash: string, mintingAmount: string, instantTime: number) {
    super();

    this.currencyHash = currencyHash;
    this.mintingAmount = mintingAmount;
    this.instantTime = instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes(): Uint8Array {
    const currencyHashBytes = utils.hexToBytes(this.currencyHash);
    const mintingAmountBytes = utils.getBytesFromString(this.mintingAmount);
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

  public getBytes(): Uint8Array {
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

export class TokenHistorySignature extends Signature {
  private currencyHash: string;
  private instantTime: number;

  constructor(params: { instantTime: number; currencyHash: string }) {
    super();
    this.currencyHash = params.currencyHash;
    this.instantTime = params.instantTime;
    this.signingType = SigningType.MESSAGE;
  }

  public getBytes(): Uint8Array {
    const currencyHashBytes = utils.hexToBytes(this.currencyHash);
    const instantTimeBytes = utils.numberToByteArray(this.instantTime, 8);

    return utils.concatByteArrays([currencyHashBytes, instantTimeBytes]);
  }
}

export class BridgeCreateRefundRequestSignature extends Signature {
  private readonly swapUuid: string;

  constructor(swapUuid: string, signature?: SignatureData) {
    super(signature);
    this.swapUuid = swapUuid;
  }

  public getBytes() {
    return utils.getBytesFromString(this.swapUuid);
  }
}

export class FaucetSignature extends Signature {
  private readonly address: string;
  private readonly currencyHash: string;
  private readonly amount: number;
  private readonly timestamp: number;

  constructor(address: string, currencyHash: string, amount: number, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.address = address;
    this.currencyHash = currencyHash;
    this.amount = amount;
    this.timestamp = timestamp;
  }

  public getBytes() {
    const addressHashBytes = utils.getBytesFromString(this.address.toString());
    const currencyHashBytes = utils.getBytesFromString(this.currencyHash.toString());
    const amountBytes = utils.getBytesFromString(utils.removeZerosFromEndOfNumber(this.amount));
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([addressHashBytes,currencyHashBytes, amountBytes, timestampBytes]);
  }
}

export class TreasuryEnrollSignature extends Signature {
  private readonly depositUuids: string[];
  private readonly programUuid: string;
  private readonly lockDays: number;
  private readonly timestamp: number;
  private readonly dropAddress: string;
  constructor(depositUuids: string[], dropAddress: string, programUuid: string, lockDays: number, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.depositUuids = depositUuids;
    this.programUuid = programUuid;
    this.lockDays = lockDays;
    this.dropAddress = dropAddress;
    this.timestamp = timestamp;
  }
  public getBytes(): Uint8Array {
    const depositUuidsBytes = getBytesFromArrayOfStrings(this.depositUuids);
    const programIdBytes = utils.getBytesFromString(this.programUuid);
    const dropAddressBytes = utils.getBytesFromString(this.dropAddress);
    const lockDaysBytes = utils.numberToByteArray(this.lockDays, 3);
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([depositUuidsBytes, programIdBytes, lockDaysBytes, dropAddressBytes, timestampBytes]);
  }
}
export class TreasuryEnrollEstimationSignature extends Signature {
  private readonly depositUuids: string[];
  private readonly programUuid: string;
  private readonly lockDays: number;
  private readonly timestamp: number;
  constructor(depositUuids: string[], programUuid: string, lockDays: number, timestamp: number, signature?: SignatureData) {
    super(signature);
    this.depositUuids = depositUuids;
    this.programUuid = programUuid;
    this.lockDays = lockDays;
    this.timestamp = timestamp;
  }
  public getBytes(): Uint8Array {
    const depositUuidsBytes = getBytesFromArrayOfStrings(this.depositUuids);
    const programIdBytes = utils.getBytesFromString(this.programUuid);
    const lockDaysBytes = utils.numberToByteArray(this.lockDays, 3);
    const timeInSeconds = this.timestamp * 1000;
    const timestampBytes = utils.numberToByteArray(timeInSeconds, 8);
    return utils.concatByteArrays([depositUuidsBytes, programIdBytes, lockDaysBytes, timestampBytes]);
  }
}

export class TreasuryErcConnectSignature extends Signature {
  private readonly cotiAddress: string;
  private readonly ethAddress: string;
  constructor(cotiAddress: string, ethAddress: string, signature?: SignatureData) {
    super(signature);
    this.cotiAddress = cotiAddress;
    this.ethAddress = ethAddress;
  }
  public getBytes(): Uint8Array {
    const cotiAddressBytes = utils.getBytesFromString(this.cotiAddress);
    const ethAddressBytes = utils.getBytesFromString(this.ethAddress);
    return utils.concatByteArrays([cotiAddressBytes, ethAddressBytes]);
  }
}
