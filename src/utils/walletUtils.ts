import axios from 'axios';
import { FullNodeFeeSignature } from '../signature';
import { BaseAddress, IndexedAddress } from '../address';
import { BaseTransaction } from '../baseTransaction';
import { Transaction } from '../transaction';
import { IndexedWallet } from '../wallet';
import * as utils from './utils';
import * as nodeUtils from './nodeUtils';

const fullNodeUrl = process.env.FULL_NODE_URL;
const trustScoreUrl = process.env.TRUSTSCORE_URL;

export async function getAddressesOfWallet<T extends IndexedAddress>(wallet: IndexedWallet<T>) {
  let addressesToCheck: string[] = [];
  let addressesThatExists: T[] = [];
  let nextChunk = 0;
  let notExistsAddressFound = false;
  const generatedAddressMap = new Map<string, T>();

  while (!notExistsAddressFound) {
    for (let i = nextChunk; i < nextChunk + 20; i++) {
      const address = await wallet.generateAddressByIndex(i);
      generatedAddressMap.set(address.getAddressHex(), address);
      addressesToCheck.push(address.getAddressHex());
    }
    let addressesResult = await nodeUtils.checkAddressesExist(addressesToCheck, wallet.getNetwork());
    Object.keys(addressesResult)
      .filter(addressHex => addressesResult[addressHex] === true)
      .forEach(addressHex => {
        const generatedAddress = generatedAddressMap.get(addressHex);
        if (generatedAddress) addressesThatExists.push(generatedAddress);
      });
    notExistsAddressFound = Object.values(addressesResult).filter(val => val === false).length ? true : false;
    addressesToCheck = [];
    nextChunk = nextChunk + 20;
  }
  return addressesThatExists;
}

export async function getTransactionsHistory(addresses: string[]) {
  const transactionMap = new Map<string, Transaction>();
  let response = await axios.post(`${fullNodeUrl}/transaction/addressTransactions/batch`, { addresses });

  let parsedData = response.data;
  if (typeof parsedData !== 'object') {
    parsedData = JSON.parse(parsedData.substring(0, parsedData.length - 2).concat(']'));
  }
  const transactionsData: Transaction[] = parsedData;
  transactionsData.forEach(transaction => {
    if (transactionMap.get(transaction.getHash())) return;

    transaction.setCreateTime(transaction.getCreateTime() * 1000);
    const transactionConsensusUpdateTime = transaction.getTransactionConsensusUpdateTime();
    if (transactionConsensusUpdateTime) {
      transaction.setTransactionConsensusUpdateTime(transactionConsensusUpdateTime * 1000);
    }
    transactionMap.set(transaction.getHash(), transaction);
  });

  return transactionMap;
}

export async function getFullNodeFees<T extends IndexedAddress>(
  wallet: IndexedWallet<T>,
  amountToTransfer: number,
  feeIncluded?: boolean
) {
  const userHash = wallet.getPublicHash();
  const userSignature = await new FullNodeFeeSignature(amountToTransfer).sign(wallet);
  const network = wallet.getNetwork();
  return await nodeUtils.getFullNodeFees(amountToTransfer, userHash, userSignature, network, feeIncluded);
}

export async function getTransactionTrustScoreFromTsNode<T extends IndexedAddress>(
  wallet: IndexedWallet<T>,
  userHash: string,
  transaction: Transaction
) {
  const transactionHash = transaction.getHash() || transaction.createTransactionHash();
  const userSignature = await wallet.signMessage(utils.hexToBytes(transactionHash));
  const network = wallet.getNetwork();
  return await nodeUtils.getTransactionTrustScore(userHash, transactionHash, userSignature, network);
}
