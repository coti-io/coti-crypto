import { keccak256 } from 'js-sha3';
import { BaseTransaction, BaseTransactionName } from './baseTransaction';
import * as utils from './utils/utils';
import { BaseAddress, IndexedAddress } from './address';
import { SignatureData } from './signature';
import { IndexedWallet } from './wallet';
import BigDecimal = utils.BigDecimal;
import * as cryptoUtils from './utils/cryptoUtils';
import { PrivateKey } from './ecKeyPair';

type KeyPair = cryptoUtils.KeyPair;

export enum TransactionType {
  INITIAL = 'Initial',
  PAYMENT = 'Payment',
  TRANSFER = 'Transfer',
  ZEROSPEND = 'ZeroSpend',
  CHARGEBACK = 'Chargeback',
}

export class ReducedTransaction {
  hash: string;
  createTime: number;
  transactionConsensusUpdateTime?: number;

  constructor(hash: string, createTime: number, transactionConsensusUpdateTime?: number) {
    this.hash = hash;
    this.createTime = createTime;
    this.transactionConsensusUpdateTime = transactionConsensusUpdateTime;
  }
}

export class Transaction {
  private hash!: string;
  private baseTransactions: BaseTransaction[];
  private createTime: number;
  private transactionConsensusUpdateTime?: number;
  private transactionDescription: string;
  private trustScoreResults: string[];
  private senderHash: string;
  private senderSignature!: SignatureData;
  private type: TransactionType;

  constructor(
    listOfBaseTransaction: BaseTransaction[],
    transactionDescription = 'No description',
    userHash: string,
    type?: TransactionType,
    createHash = true
  ) {
    this.baseTransactions = [];

    for (let i = 0; i < listOfBaseTransaction.length; i++) {
      this.baseTransactions.push(listOfBaseTransaction[i]);
    }

    this.createTime = utils.getUtcInstant(); //it gets the utc time in milliseconds
    this.transactionDescription = transactionDescription;
    this.trustScoreResults = [];
    this.senderHash = userHash;
    this.type = type || TransactionType.TRANSFER;

    if (createHash) this.createTransactionHash();
  }

  public addBaseTransaction(address: BaseAddress, valueToSend: BigDecimal, name: BaseTransactionName) {
    let baseTransaction = new BaseTransaction(address.getAddressHex(), valueToSend, name);
    this.baseTransactions.push(baseTransaction);
  }

  public createTransactionHash() {
    let bytesOfAllBaseTransactions: number[] = [];
    this.baseTransactions.forEach(baseTransaction => {
      bytesOfAllBaseTransactions = bytesOfAllBaseTransactions.concat(baseTransaction.getHashArray());
    });

    let hashOfBaseTransactions = keccak256.update(bytesOfAllBaseTransactions).array();
    this.hash = utils.byteArrayToHexString(new Uint8Array(hashOfBaseTransactions));
    return this.hash;
  }

  public addTrustScoreMessageToTransaction(trustScoreMessage: string) {
    this.trustScoreResults.push(trustScoreMessage);
  }

  public getSenderHash() {
    return this.senderHash;
  }

  public getHash() {
    return this.hash;
  }

  public getCreateTime() {
    return this.createTime;
  }

  public setCreateTime(createTime: number) {
    this.createTime = createTime;
  }

  public getTransactionConsensusUpdateTime() {
    return this.transactionConsensusUpdateTime;
  }

  public setTransactionConsensusUpdateTime(transactionConsensusUpdateTime: number) {
    this.transactionConsensusUpdateTime = transactionConsensusUpdateTime;
  }

  public async signTransaction<T extends IndexedAddress>(wallet: IndexedWallet<T>) {
    const messageInBytes = this.getSignatureMessage();
    this.senderSignature = await wallet.signMessage(messageInBytes);

    for (let i = 0; i < this.baseTransactions.length; i++) {
      await this.baseTransactions[i].sign(this.hash, wallet);
    }
  }

  public signWithPrivateKeys(userPrivateKey: string, inputPrivateKeys: string[]) {
    const userKeyPair = new PrivateKey(userPrivateKey).keyPair;
    const inputKeyPairs = inputPrivateKeys.map(inputPrivateKey => new PrivateKey(inputPrivateKey).keyPair);
    this.signWithKeyPairs(userKeyPair, inputKeyPairs);
  }

  public signWithKeyPairs(userKeyPair: KeyPair, inputKeyPairs: KeyPair[]) {
    const messageInBytes = this.getSignatureMessage();
    this.senderSignature = cryptoUtils.signByteArrayMessage(messageInBytes, userKeyPair);

    const inputBaseTransactions = this.getInputBaseTransactions();
    if (inputBaseTransactions.length !== inputKeyPairs.length) throw new Error(`Error at number of input key pairs`);

    for (let i = 0; i < inputBaseTransactions.length; i++) {
      inputBaseTransactions[i].signWithKeyPair(this.hash, inputKeyPairs[i]);
    }
  }

  public getInputBaseTransactions() {
    return this.baseTransactions.filter(baseTransaction => baseTransaction.isInput());
  }

  private getSignatureMessage() {
    const transactionHashInBytes = utils.hexToBytes(this.hash);
    const transactionTypeInBytes = utils.getBytesFromString(this.type);
    const utcTime = this.createTime * 1000;
    const utcTimeInByteArray = utils.numberToByteArray(utcTime, 8);
    const transactionDescriptionInBytes = utils.getBytesFromString(this.transactionDescription);
    let messageInBytes = utils.concatByteArrays([transactionHashInBytes, transactionTypeInBytes, utcTimeInByteArray, transactionDescriptionInBytes]);

    return new Uint8Array(keccak256.update(messageInBytes).arrayBuffer());
  }
}
