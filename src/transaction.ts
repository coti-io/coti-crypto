import { keccak256 } from 'js-sha3';
import { BaseTransaction, BaseTransactionData, BaseTransactionName } from './baseTransaction';
import * as utils from './utils/utils';
import { BaseAddress, IndexedAddress } from './address';
import { SignatureData, SigningType } from './signature';
import { IndexedWallet } from './wallet';
import * as cryptoUtils from './utils/cryptoUtils';
import { PrivateKey } from './ecKeyPair';
import BigDecimal = utils.BigDecimal;

type KeyPair = cryptoUtils.KeyPair;

export enum TransactionType {
  INITIAL = 'Initial',
  PAYMENT = 'Payment',
  TRANSFER = 'Transfer',
  ZEROSPEND = 'ZeroSpend',
  CHARGEBACK = 'Chargeback',
  TOKEN_GENERATION = 'TokenGeneration',
  TOKEN_MINTING = 'TokenMinting',
}

export type TransactionStatus = 'pending' | 'confirmed';

export type OriginatorCurrencyData = {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  scale: number;
  originatorHash: string;
  originatorSignature: SignatureData;
};
export type CurrencyTypeData = {
  currencyType: string;
  createTime: number;
  currencyRateSourceType: string;
  rateSource: string;
  protectionModel: string;
  signerHash: string;
  signature: SignatureData;
};

export type ServiceData = {
  originatorCurrencyData: OriginatorCurrencyData;
  currencyTypeData: CurrencyTypeData;
  feeAmount: string;
};

export class ReducedTransaction {
  readonly hash: string;
  readonly createTime: number;
  readonly transactionConsensusUpdateTime?: number;

  constructor(hash: string, createTime: number, transactionConsensusUpdateTime?: number) {
    this.hash = hash;
    this.createTime = createTime;
    this.transactionConsensusUpdateTime = transactionConsensusUpdateTime;
  }
}

type TransactionTime = 'createTime' | 'attachmentTime' | 'transactionConsensusUpdateTime';

export interface TransactionData {
  hash: string;
  baseTransactions: BaseTransactionData[];
  createTime: number;
  attachmentTime: number;
  transactionConsensusUpdateTime?: number;
  childrenTransactionHashes: string[];
  leftParentHash: string;
  rightParentHash: string;
  transactionDescription: string;
  trustChainConsensus: string;
  trustChainTrustScore: number;
  type: TransactionType;
  senderHash: string;
  status: TransactionStatus;
  isValid: boolean;
  currencyHash?: string;
}

export class TransactionData {
  constructor(transactionData: TransactionData) {
    Object.assign(this, transactionData, {
      baseTransactions: transactionData.baseTransactions.map(baseTransactionData => new BaseTransactionData(baseTransactionData)),
    });
    this.setTime('createTime', transactionData.createTime);
    this.setTime('attachmentTime', transactionData.attachmentTime);
    this.setTime('transactionConsensusUpdateTime', transactionData.transactionConsensusUpdateTime);
  }

  public setStatus() {
    this.status = this.transactionConsensusUpdateTime ? 'confirmed' : 'pending';
  }

  public setTime(timeField: TransactionTime, time?: number | string) {
    if (typeof time === 'string') {
      this[timeField] = utils.utcStringToSeconds(time);
    } else if (typeof time === 'number') {
      this[timeField] = time;
    }
  }
}

export class Transaction {
  private hash!: string;
  private readonly baseTransactions: BaseTransaction[];
  private createTime: number;
  private transactionConsensusUpdateTime?: number;
  private readonly transactionDescription: string;
  private trustScoreResults: string[];
  private readonly senderHash: string;
  private senderSignature!: SignatureData;
  private readonly type: TransactionType;

  constructor(
    baseTransactions: BaseTransaction[],
    transactionDescription = 'No description',
    userHash: string,
    type?: TransactionType,
    createHash = true,
    createTime?: number
  ) {
    this.baseTransactions = [];

    for (let baseTransaction of baseTransactions) {
      this.baseTransactions.push(baseTransaction);
    }

    this.createTime = createTime || utils.utcNowToSeconds();
    this.transactionDescription = transactionDescription;
    this.trustScoreResults = [];
    this.senderHash = userHash;
    this.type = type || TransactionType.TRANSFER;

    if (createHash) this.createTransactionHash();
  }

  public addBaseTransaction(address: BaseAddress, valueToSend: BigDecimal, name: BaseTransactionName): void {
    let baseTransaction = new BaseTransaction(address.getAddressHex(), valueToSend, name);
    this.baseTransactions.push(baseTransaction);
  }

  public createTransactionHash(): string {
    let bytesOfAllBaseTransactions: number[] = [];
    this.baseTransactions.forEach(baseTransaction => {
      bytesOfAllBaseTransactions = bytesOfAllBaseTransactions.concat(baseTransaction.getHashArray());
    });

    let hashOfBaseTransactions = keccak256.update(bytesOfAllBaseTransactions).array();
    this.hash = utils.byteArrayToHexString(new Uint8Array(hashOfBaseTransactions));
    return this.hash;
  }

  public addTrustScoreMessageToTransaction(trustScoreMessage: string): void {
    this.trustScoreResults.push(trustScoreMessage);
  }

  public getSenderHash(): string {
    return this.senderHash;
  }

  public getHash(): string {
    return this.hash;
  }

  public getCreateTime(): number {
    return this.createTime;
  }

  public setCreateTime(createTime: number): void {
    this.createTime = createTime;
  }

  public getTransactionConsensusUpdateTime(): number | undefined {
    return this.transactionConsensusUpdateTime;
  }

  public setTransactionConsensusUpdateTime(transactionConsensusUpdateTime: number): void {
    this.transactionConsensusUpdateTime = transactionConsensusUpdateTime;
  }

  public async signTransaction<T extends IndexedAddress>(wallet: IndexedWallet<T>): Promise<void> {
    let totalAmount = new BigDecimal(0);
    for (let baseTransaction of this.baseTransactions) {
      if (baseTransaction.isInput()) {
        totalAmount = totalAmount.add(baseTransaction.getAmount());
      }
      await baseTransaction.sign(this.hash, wallet);
    }

    const messageInBytes = this.getSignatureMessage();
    this.senderSignature = await wallet.signMessage(messageInBytes, SigningType.TX, undefined, {
      amount: totalAmount.multiply(new BigDecimal('-1')).toPlainString(),
    });
  }

  public signWithPrivateKeys(userPrivateKey: string, inputPrivateKeys: string[]): void {
    const userKeyPair = new PrivateKey(userPrivateKey).keyPair;
    const inputKeyPairs = inputPrivateKeys.map(inputPrivateKey => new PrivateKey(inputPrivateKey).keyPair);
    this.signWithKeyPairs(userKeyPair, inputKeyPairs);
  }

  public signWithKeyPairs(userKeyPair: KeyPair, inputKeyPairs: KeyPair[]): void {
    const inputBaseTransactions = this.getInputBaseTransactions();
    if (inputBaseTransactions.length !== inputKeyPairs.length) throw new Error(`Error at number of input key pairs`);

    for (let i = 0; i < inputBaseTransactions.length; i++) {
      inputBaseTransactions[i].signWithKeyPair(this.hash, inputKeyPairs[i]);
    }

    const messageInBytes = this.getSignatureMessage();
    this.senderSignature = cryptoUtils.signByteArrayMessage(messageInBytes, userKeyPair);
  }

  public getInputBaseTransactions(): BaseTransaction[] {
    return this.baseTransactions.filter(baseTransaction => baseTransaction.isInput());
  }

  public getOutputBaseTransactions(): BaseTransaction[] {
    return this.baseTransactions.filter(baseTransaction => baseTransaction.isOutput());
  }

  public getFullNodeFee(): utils.BigDecimal {
    return this.getOutputBaseTransactions()[0].getAmount();
  }

  public getNetworkFee(): utils.BigDecimal {
    return this.getOutputBaseTransactions()[1].getAmount();
  }

  private getSignatureMessage(): Uint8Array {
    const transactionHashInBytes = utils.hexToBytes(this.hash);
    const transactionTypeInBytes = utils.getBytesFromString(this.type);
    const utcTime = this.createTime * 1000;
    const utcTimeInByteArray = utils.numberToByteArray(utcTime, 8);
    const transactionDescriptionInBytes = utils.getBytesFromString(this.transactionDescription);
    let messageInBytes = utils.concatByteArrays([transactionHashInBytes, transactionTypeInBytes, utcTimeInByteArray, transactionDescriptionInBytes]);

    return new Uint8Array(keccak256.update(messageInBytes).arrayBuffer());
  }
}
