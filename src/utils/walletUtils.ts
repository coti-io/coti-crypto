import axios from 'axios';
import { FullNodeFeeSignature } from '../signature';
import { BaseAddress, IndexedAddress } from '../address';
import { BaseTransaction } from '../baseTransaction';
import { Transaction } from '../transaction';
import { IndexedWallet } from '../wallet';
import { hexToBytes } from './utils';

const fullNodeUrl = process.env.FULL_NODE_URL;
const trustScoreUrl = process.env.TRUSTSCORE_URL;

export async function getUserTrustScore(userHash: string) {
  try {
    return await axios.post(`${trustScoreUrl}/usertrustscore`, {
      userHash,
    });
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting user trust score, error: ${errorMessage}`);
  }
}

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
    let addressesResult = await checkAddressesExist(addressesToCheck);
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

async function checkAddressesExist(addressesToCheck: string[]) {
  try {
    const { data } = await axios.post(`${fullNodeUrl}/address`, { addresses: addressesToCheck });
    return data.addresses;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking existing addresses from fullnode: ${errorMessage}`);
  }
}

export async function sendAddressToNode(address: BaseAddress) {
  try {
    const { data } = await axios.put(`${fullNodeUrl}/address`, { address: address.getAddressHex() });
    return data;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error sending address to fullnode: ${errorMessage}`);
  }
}

export async function checkBalances(addresses: string[]) {
  try {
    const { data } = await axios.post(`${fullNodeUrl}/balance`, { addresses });
    return data.addressesBalance;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking address balances from fullnode: ${errorMessage} for addresses: ${addresses}`);
  }
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
  try {
    const userHash = wallet.getPublicHash();
    const userSignature = await new FullNodeFeeSignature(amountToTransfer).sign(wallet);
    const response = await axios.put(`${fullNodeUrl}/fee`, {
      originalAmount: amountToTransfer,
      userHash,
      userSignature,
      feeIncluded,
    });
    return response.data.fullNodeFee;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting full node fees: ${errorMessage} for amount: ${amountToTransfer}`);
  }
}

export async function getNetworkFees(fullNodeFeeData: BaseTransaction, userHash: string, feeIncluded?: boolean) {
  try {
    const response = await axios.put(`${trustScoreUrl}/networkFee`, { fullNodeFeeData, userHash, feeIncluded });
    return response.data.networkFeeData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting network fee: ${errorMessage}`);
  }
}

export async function getTrustScoreFromTsNode<T extends IndexedAddress>(
  wallet: IndexedWallet<T>,
  userHash: string,
  transaction: Transaction
) {
  const transactionHash = transaction.createTransactionHash();
  const createTrustScoreMessage = {
    userHash,
    transactionHash,
    userSignature: await wallet.signMessage(hexToBytes(transactionHash)),
  };
  try {
    const response = await axios.post(`${trustScoreUrl}/transactiontrustscore`, createTrustScoreMessage);
    return response.data.transactionTrustScoreData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting trust score from trust score node: ${errorMessage}`);
  }
}

export async function createMiniConsensus(
  userHash: string,
  fullNodeFeeData: BaseTransaction,
  networkFeeData: BaseTransaction
) {
  const iteration = 3;
  let validationNetworkFeeMessage = {
    fullNodeFeeData,
    networkFeeData,
    userHash,
  };
  let response;
  try {
    for (let i = 1; i < iteration; i++) {
      response = await axios.post(`${trustScoreUrl}/networkFee`, validationNetworkFeeMessage);
      validationNetworkFeeMessage.networkFeeData = response.data.networkFeeData;
    }
    if (response && response.data) return { fullNodeFee: fullNodeFeeData, networkFee: response.data.networkFeeData };
    else throw new Error(`Error in createMiniConsensus: No response`);
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error in createMiniConsensus: ${errorMessage}`);
  }
}
