import axios, { AxiosResponse } from 'axios';
import { BaseAddress } from '../address';
import { BaseTransactionData, BaseTransactionName } from '../baseTransaction';
import { SignatureData, TokenCurrenciesSignature } from '../signature';
import * as utils from './utils';
import { Transaction, TransactionData, TransactionType } from '../transaction';
import { NodeError } from '../cotiError';
import { BaseTransaction, BigDecimal, cryptoUtils, Wallet } from '..';

type Network = utils.Network;

type UserType = 'consumer' | 'fullnode';

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
};

export namespace nodeUtils {
  export async function getUserTrustScore(userHash: string, network: Network = 'mainnet', trustScoreNode?: string) {
    try {
      const { data } = await axios.post(`${trustScoreNode || nodeUrl[network].trustScoreNode}/usertrustscore`, {
        userHash,
      });
      return data;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error getting user trust score` });
    }
  }

  export async function sendAddressToNode(address: BaseAddress, network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.put(`${fullnode || nodeUrl[network].fullNode}/address`, { address: address.getAddressHex() });
      return data;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error sending address to fullnode` });
    }
  }

  export async function checkAddressesExist(addressesToCheck: string[], network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/address`, { addresses: addressesToCheck });
      return data.addresses;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error checking existing addresses from fullnode` });
    }
  }

  export async function checkBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance`, { addresses });
      return data.addressesBalance;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error checking address balances from fullnode` });
    }
  }

  export async function getTokenBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance/tokens`, { addresses });
      return data.tokenBalances;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error checking address balances from fullnode` });
    }
  }

  export async function getTransaction(transactionHash: string, network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/transaction`, { transactionHash });
      let transaction: TransactionData = data.transactionData;
      transaction = new TransactionData(transaction);
      transaction.setStatus();
      return transaction;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error getting transaction from fullnode for hash: ${transactionHash}` });
    }
  }

  export async function getTransactionsHistory(addresses: string[], network: Network = 'mainnet', fullnode?: string) {
    let response = await axios.post(`${fullnode || nodeUrl[network].fullNode}/transaction/addressTransactions/batch`, { addresses });
    return getMapFromTransactionHistoryResponse(response);
  }

  function getMapFromTransactionHistoryResponse(response: AxiosResponse<any>) {
    const transactionMap = new Map<string, TransactionData>();
    let parsedData = response.data;
    if (typeof parsedData !== 'object') {
      parsedData = JSON.parse(parsedData.substring(0, parsedData.length - 2).concat(']'));
    }
    const transactionsData: TransactionData[] = parsedData;
    transactionsData.forEach(transaction => {
      if (transactionMap.get(transaction.hash)) return;

      transaction = new TransactionData(transaction);
      transaction.setStatus();
      transactionMap.set(transaction.hash, transaction);
    });

    return transactionMap;
  }

  export async function getTransactionsHistoryByTimeStamp(
    addresses: string[],
    network: Network = 'mainnet',
    fullnode?: string,
    startTime?: number,
    endTime?: number
  ) {
    let response = await axios.post(`${fullnode || nodeUrl[network].fullNode}/transaction/addressTransactions/timestamp/batch`, {
      addresses,
      startTime,
      endTime,
    });

    return getMapFromTransactionHistoryResponse(response);
  }

  export async function getFullNodeFees(
    amountToTransfer: number,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet',
    feeIncluded?: boolean,
    fullnode?: string,
    originalCurrencyHash?: string,
  ) {
    try {
      const response = await axios.put(`${fullnode || nodeUrl[network].fullNode}/fee`, {
        originalAmount: amountToTransfer,
        userHash,
        userSignature,
        feeIncluded,
        originalCurrencyHash
      });
      return new BaseTransactionData(response.data.fullNodeFee);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error getting full node fees for amount ${amountToTransfer}` });
    }
  }

  export async function getNetworkFees(
    fullNodeFeeData: BaseTransactionData,
    userHash: string,
    network: Network = 'mainnet',
    feeIncluded?: boolean,
    trustScoreNode?: string
  ) {
    try {
      const response = await axios.put(`${trustScoreNode || nodeUrl[network].trustScoreNode}/networkFee`, {
        fullNodeFeeData,
        userHash,
        feeIncluded,
      });
      return new BaseTransactionData(response.data.networkFeeData);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error getting network fee` });
    }
  }

  export async function createMiniConsensus(
    userHash: string,
    fullNodeFeeData: BaseTransactionData,
    networkFeeData: BaseTransactionData,
    network: Network = 'mainnet',
    trustScoreNode?: string
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
        response = await axios.post(`${trustScoreNode || nodeUrl[network].trustScoreNode}/networkFee`, validationNetworkFeeMessage);
        validationNetworkFeeMessage.networkFeeData = response.data.networkFeeData;
      }
      if (response && response.data) return new BaseTransactionData(response.data.networkFeeData);
      else throw new Error(`Error in createMiniConsensus: No response`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error in createMiniConsensus` });
    }
  }

  export async function getTrustScoreForTransaction(
    transactionHash: string,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet',
    trustScoreNode?: string
  ) {
    const trustScoreMessage = {
      userHash,
      transactionHash,
      userSignature,
    };
    try {
      const response = await axios.post(`${trustScoreNode || nodeUrl[network].trustScoreNode}/transactiontrustscore`, trustScoreMessage);
      return response.data.transactionTrustScoreData;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error getting trust score from trust score node` });
    }
  }
  
  export async function sendTransaction(transaction: Transaction, network: Network = 'mainnet', fullnode?: string) {
    try {
      const response = await axios.put(`${fullnode || nodeUrl[network].fullNode}/transaction`, transaction);
      return response.data;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new NodeError(errorMessage, { debugMessage: `Error sending transaction with hash ${transaction.getHash()}` });
    }
  }

  export function getSocketUrl(network: Network = 'mainnet', fullnode?: string) {
    return (fullnode || nodeUrl[network].fullNode) + '/websocket';
  }

  export async function setTrustScore(apiKey: string, userHash: string, network: Network = 'mainnet', api?: string) {
    if (!apiKey) throw new NodeError('Api key is missing');
    const headers = { 'exchange-api-key': apiKey };
    const setTrustScoreMessage = {
      userHash,
      network,
    };
    try {
      const response = await axios.put(`${api || nodeUrl[network].api}/exchange/trustscore`, setTrustScoreMessage, { headers });
      return response.data.trustScore;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.errorMessage : error.message;
      throw new NodeError(errorMessage, { debugMessage: `Error setting trust score at trust score node` });
    }
  }

  export async function updateUserType(apiKey: string, userHash: string, network: Network = 'mainnet', userType: UserType, api?: string) {
    if (!apiKey) throw new NodeError('Api key is missing');
    const headers = { 'exchange-api-key': apiKey };
    const updateUserTypeMessage = {
      userHash,
      network,
      userType,
    };
    try {
      const response = await axios.put(`${api || nodeUrl[network].api}/exchange/userType`, updateUserTypeMessage, { headers });
      return response.data.message;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.errorMessage : error.message;
      throw new NodeError(errorMessage, { debugMessage: `Error update user type at trust score node` });
    }
  }
  
  export async function getUserTokenCurrencies(userHash: string, privateKey: string, seed: string){
    const tokenCurrencies = new TokenCurrenciesSignature(userHash);
    const indexedWallet = new Wallet({ seed });
    const signatureData = await tokenCurrencies.sign(indexedWallet, false);
    const payload = {
      userHash,
      signature: signatureData
    }
    const headers = {
      'Content-Type': "application/json"
    };

    try {
      const { data } = await axios.post(`https://coti-full-node.coti.io/currencies/token/user`,payload, { headers });
      return data.userTokens;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.errorMessage : error.message;
      throw new NodeError(errorMessage, { debugMessage: `Error update user type at trust score node` });
    }
  }
  
  export async function transactionTokenGeneration(token_generation_fee_base_transaction: BaseTransactionData,full_node_fee: BaseTransactionData, trust_score_data: string, wallet_address_IBT: string, seed: string, userHash: string, transactionType: TransactionType, network: Network = 'mainnet', api: string, transactionDescription: string){
    const instant_time = Math.floor(new Date().getTime() / 1000)
    const instant_time1 = instant_time * 1000;
    const IBT_addressHash = wallet_address_IBT;
    const tokenGenerationFee = new BigDecimal(token_generation_fee_base_transaction.amount);
    const fullNodeFeeAmount = new BigDecimal(full_node_fee.amount);
    const fullAmount = tokenGenerationFee.add(fullNodeFeeAmount);
    
    const headers = {
      'Content-Type': "application/json"
    };

    //TODO: move out to function
    const IBT_amount = parseFloat(fullAmount.toString()) * -1;
    const addressHashBytes = utils.hexToBytes(IBT_addressHash);
    const instantTimeBytes = utils.numberToByteArray(instant_time1, 8);
    const currencyHashBytes = full_node_fee.currencyHash? utils.hexToBytes(full_node_fee.currencyHash): new Uint8Array();
    const messageI = `${IBT_amount}`;
    const messageBytes = utils.getBytesFromString(messageI);
    const bytesToMerge = utils.concatByteArrays([ addressHashBytes, messageBytes, instantTimeBytes, currencyHashBytes ]);
    const IBT_Hash = cryptoUtils.hashKeccak256(bytesToMerge);

    const msgT = IBT_Hash + full_node_fee.hash + token_generation_fee_base_transaction.hash;
    const hT = cryptoUtils.hashKeccak256(utils.hexToBytes(msgT));

    const IBTAmountBD = new BigDecimal(IBT_amount);
    const IBT_Transaction = new BaseTransaction(wallet_address_IBT, IBTAmountBD, BaseTransactionName.INPUT, undefined, undefined, fullAmount, full_node_fee.currencyHash, IBT_Hash, instant_time, undefined)
    const fullNodeFeeBaseTransaction = BaseTransaction.getBaseTransactionFromFeeData(full_node_fee);
    const tokenGenerationFeeBaseTransaction = BaseTransaction.getBaseTransactionFromFeeData(token_generation_fee_base_transaction);
    
    const baseTransaction = [IBT_Transaction, fullNodeFeeBaseTransaction, tokenGenerationFeeBaseTransaction];
    const tokenGenerationTransaction = new Transaction(baseTransaction, transactionDescription, userHash, transactionType, true, instant_time);
    tokenGenerationTransaction.addTrustScoreMessageToTransaction(trust_score_data)

    const indexedWallet = new Wallet({ seed });
    const address = await indexedWallet.getAddressByIndex(0);
    IBT_Transaction.signWithKeyPair(hT, address.getAddressKeyPair());
    await tokenGenerationTransaction.signTransaction(indexedWallet);
    
    try {
      const { data } = await axios.put(`${api || nodeUrl[network].api}/transaction`, tokenGenerationTransaction, { headers });
      return data;
    } catch (error) {
      const errorMessage = 
      error.response && error.response.data ? error.response.data.errorMessage : error.message;
      throw new NodeError(errorMessage, { debugMessage: `Error update user type at trust score node` });
    }
  }

  function getErrorMessage(error: any) {
    return error.response && error.response.data ? error.response.data.message : error.message;
  }
}
