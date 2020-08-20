import { keccak256 } from 'js-sha3';
import { BaseTransaction } from './baseTransaction';
import * as utils from './utils/utils';
import { BaseAddress } from './baseAddress';
import { SignatureData } from './signature';

export enum TransactionType {
  INITIAL = 'Initial',
  PAYMENT = 'Payment',
  TRANSFER = 'Transfer',
  ZEROSPEND = 'ZeroSpend',
  CHARGEBACK = 'Chargeback'
}

// export interface ReducedTransaction {
//   hash: string;
//   createTime: number;
//   transactionConsensusUpdateTime?: number;
// }

export class ReducedTransaction {
    hash: string;
    createTime: number;
    transactionConsensusUpdateTime?: number;

  constructor(transaction: Transaction) {
    this.hash = transaction.getTransactionHash();
    this.createTime = transaction.getCreateTime();
    this.transactionConsensusUpdateTime = transaction.getTransactionConsensusUpdateTime();
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
  private signatureData!: SignatureData;
  private type: TransactionType;

  constructor(
    listOfBaseTransaction: BaseTransaction[],
    transactionDescription: string,
    userHash: string,
    type: TransactionType
  ) {
    if (!transactionDescription) throw new Error('Transaction must have a description');

    this.baseTransactions = [];

    for (let i = 0; i < listOfBaseTransaction.length; i++) {
      this.baseTransactions.push(listOfBaseTransaction[i]);
    }

    this.createTime = utils.getUtcInstant(); //it gets the utc time in milliseconds
    this.transactionDescription = transactionDescription;
    this.trustScoreResults = [];
    this.senderHash = userHash;
    this.type = type || TransactionType.TRANSFER;
  }

  addBaseTransaction(address: BaseAddress, valueToSend: number, name: string) {
    let baseTransaction = new BaseTransaction(address, valueToSend, name);
    this.baseTransactions.push(baseTransaction);
  }

  createTransactionHash() {
    let bytesOfAllBaseTransactions: number[] = [];
    this.baseTransactions.forEach(baseTransaction => {
      bytesOfAllBaseTransactions = bytesOfAllBaseTransactions.concat(baseTransaction.getHashArray());
    });

    let hashOfBaseTransactions = keccak256.update(bytesOfAllBaseTransactions).array();
    this.hash = utils.byteArrayToHexString(new Uint8Array(hashOfBaseTransactions));
    return this.hash;
  }

  addTrustScoreMessageToTransaction(trustScoreMessage: string) {
    this.trustScoreResults.push(trustScoreMessage);
  }

  setTrustScoreMessageSignatureData(signatureTrustScoreRequest: SignatureData) {
    this.signatureData = signatureTrustScoreRequest;
  }

  createTrustScoreMessage() {
    return {
      userHash: this.senderHash,
      transactionHash: this.hash,
      transactionTrustScoreSignature: this.signatureData
    };
  }

  getSenderHash() {
    return this.senderHash;
  }

  getTransactionHash() {
    return this.hash;
  }

  getCreateTime() {
    return this.createTime;
  }

  getTransactionConsensusUpdateTime() {
      return this.transactionConsensusUpdateTime;
  }

  signTransaction(wallet) {
    const transactionHashInBytes = utils.hexToBytes(this.hash);
    const transactionTypeInBytes = utils.getBytesFromString(this.type);
    const utcTime = this.createTime * 1000;
    const utcTimeInByteArray = utils.numberToByteArray(utcTime, 8);
    const transactionDescriptionInBytes = utils.getBytesFromString(this.transactionDescription);
    let messageInBytes = utils.concatByteArrays([
      transactionHashInBytes,
      transactionTypeInBytes,
      utcTimeInByteArray,
      transactionDescriptionInBytes
    ]);

    messageInBytes = new Uint8Array(keccak256.update(messageInBytes).arrayBuffer());

    this.signatureData = wallet.signMessage(messageInBytes);

    for (var i = 0; i < this.baseTransactions.length; i++) {
      this.baseTransactions[i].sign(this.hash, wallet);
    }
  }
}
