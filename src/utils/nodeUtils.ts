import axios from 'axios';
import { BaseAddress } from '../address';
import { BaseTransactionObject } from '../baseTransaction';
import { SignatureData } from '../signature';
import * as utils from './utils';
import { Transaction } from '../transaction';

type Network = utils.Network;

const nodeUrl = {
  mainnet: {
    fullNode: 'https://mainnet-fullnode1.coti.io',
    trustScoreNode: 'https://mainnet-trustscore1.coti.io',
    api: 'https://cca.coti.io',
  },
  testnet: {
    fullNode: 'https://testnet-fullnode1.coti.io',
    trustScoreNode: 'https://testnet-trustscore1.coti.io',
    api: 'https://cca.coti.io',
  },
  testnetStaging: {
    fullNode: 'https://testnet-staging-fullnode1.coti.io',
    trustScoreNode: 'https://testnet-staging-trustscore1.coti.io',
    api: 'https://cca-qa.coti.io',
  },
};

export namespace nodeUtils {
  export async function getUserTrustScore(userHash: string, network: Network = 'mainnet') {
    try {
      return await axios.post(`${nodeUrl[network].trustScoreNode}/usertrustscore`, {
        userHash,
      });
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting user trust score, error: ${errorMessage}`);
    }
  }

  export async function sendAddressToNode(address: BaseAddress, network: Network = 'mainnet') {
    try {
      const { data } = await axios.put(`${nodeUrl[network].fullNode}/address`, { address: address.getAddressHex() });
      return data;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error sending address to fullnode: ${errorMessage}`);
    }
  }

  export async function checkAddressesExist(addressesToCheck: string[], network: Network = 'mainnet') {
    try {
      const { data } = await axios.post(`${nodeUrl[network].fullNode}/address`, { addresses: addressesToCheck });
      return data.addresses;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error checking existing addresses from fullnode: ${errorMessage}`);
    }
  }

  export async function checkBalances(addresses: string[], network: Network = 'mainnet') {
    try {
      const { data } = await axios.post(`${nodeUrl[network].fullNode}/balance`, { addresses });
      return data.addressesBalance;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error checking address balances from fullnode: ${errorMessage} for addresses: ${addresses}`);
    }
  }

  export async function getTransaction(transactionHash: string, network: Network = 'mainnet'): Promise<Transaction> {
    try {
      const { data } = await axios.post(`${nodeUrl[network].fullNode}/transaction`, { transactionHash });
      const transaction = data.transactionData;
      transaction.createTime = transaction.createTime * 1000;
      if (transaction.transactionConsensusUpdateTime) {
        transaction.transactionConsensusUpdateTime = transaction.transactionConsensusUpdateTime * 1000;
      }
      return transaction;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting transaction from fullnode: ${errorMessage} for hash: ${transactionHash}`);
    }
  }

  export async function getTransactionsHistory(addresses: string[], network: Network = 'mainnet') {
    const transactionMap = new Map<string, Transaction>();
    let response = await axios.post(`${nodeUrl[network].fullNode}/transaction/addressTransactions/batch`, { addresses });

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

  export async function getFullNodeFees(
    amountToTransfer: number,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet',
    feeIncluded?: boolean
  ): Promise<BaseTransactionObject> {
    try {
      const response = await axios.put(`${nodeUrl[network].fullNode}/fee`, {
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

  export async function getNetworkFees(
    fullNodeFeeData: BaseTransactionObject,
    userHash: string,
    network: Network = 'mainnet',
    feeIncluded?: boolean
  ): Promise<BaseTransactionObject> {
    try {
      const response = await axios.put(`${nodeUrl[network].trustScoreNode}/networkFee`, {
        fullNodeFeeData,
        userHash,
        feeIncluded,
      });
      return response.data.networkFeeData;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting network fee: ${errorMessage}`);
    }
  }

  export async function createMiniConsensus(
    userHash: string,
    fullNodeFeeData: BaseTransactionObject,
    networkFeeData: BaseTransactionObject,
    network: Network = 'mainnet'
  ): Promise<BaseTransactionObject> {
    const iteration = 3;
    let validationNetworkFeeMessage = {
      fullNodeFeeData,
      networkFeeData,
      userHash,
    };
    let response;
    try {
      for (let i = 1; i < iteration; i++) {
        response = await axios.post(`${nodeUrl[network].trustScoreNode}/networkFee`, validationNetworkFeeMessage);
        validationNetworkFeeMessage.networkFeeData = response.data.networkFeeData;
      }
      if (response && response.data) return response.data.networkFeeData;
      else throw new Error(`Error in createMiniConsensus: No response`);
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error in createMiniConsensus: ${errorMessage}`);
    }
  }

  export async function getTrustScoreForTransaction(
    transactionHash: string,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet'
  ) {
    const createTrustScoreMessage = {
      userHash,
      transactionHash,
      userSignature,
    };
    try {
      const response = await axios.post(`${nodeUrl[network].trustScoreNode}/transactiontrustscore`, createTrustScoreMessage);
      return response.data.transactionTrustScoreData;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting trust score from trust score node: ${errorMessage}`);
    }
  }

  export async function sendTransaction(transaction: Transaction, network: Network = 'mainnet') {
    try {
      const response = await axios.put(`${nodeUrl[network].fullNode}/transaction`, transaction);
      return response.data;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error sending transaction with hash ${transaction.getHash()}: ${errorMessage} `);
    }
  }

  export function getSocketUrl(network: Network) {
    const fullNodeWebsocketAction = '/websocket';
    return nodeUrl[network].fullNode + fullNodeWebsocketAction;
  }
}
