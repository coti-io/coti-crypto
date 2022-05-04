import axios, { AxiosResponse } from 'axios';
import moment from 'moment';
import { BaseAddress } from '../address';
import { BaseTransactionData } from '../baseTransaction';
import { NodeError } from '../cotiError';
import { BalanceDto, TokensBalanceDto } from '../dtos/balance.dto';
import { TokenCurrenciesDto, TokenCurrency } from '../dtos/currencies.dto';
import { SignatureData, TokenCurrenciesSignature, TokenDetailsSignature, TokenHistorySignature } from '../signature';
import { Transaction, TransactionData } from '../transaction';
import { Wallet } from '../wallet';
import { HardForks } from './transactionUtils';
import * as utils from './utils';

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
      throw getErrorMessage(error, 'Error getting user trust score');
    }
  }

  export async function sendAddressToNode(address: BaseAddress, network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.put(`${fullnode || nodeUrl[network].fullNode}/address`, { address: address.getAddressHex() });

      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error sending address to fullnode');
    }
  }

  export async function checkAddressesExist(addressesToCheck: string[], network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/address`, { addresses: addressesToCheck });

      return data.addresses;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking existing addresses from fullnode');
    }
  }

  export async function checkBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string): Promise<BalanceDto> {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance`, { addresses });

      return data.addressesBalance;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking address balances from fullnode');
    }
  }

  export async function getTokenBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string): Promise<TokensBalanceDto> {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance/tokens`, { addresses });

      return data.tokenBalances;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking address token balances from fullnode');
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
      throw getErrorMessage(error, `Error getting transaction from fullnode for hash: ${transactionHash}`);
    }
  }

  export async function getNoneIndexTransactions(network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.get(`${fullnode || nodeUrl[network].fullNode}/transaction/none-indexed`);

      return data.transactionsData;
    } catch (error) {
      throw getErrorMessage(error, `Error getting none indexed transactions from fullnode.`);
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
    amountToTransfer: string,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet',
    feeIncluded?: boolean,
    fullnode?: string,
    originalCurrencyHash?: string
  ) {
    try {
      const response = await axios.put(`${fullnode || nodeUrl[network].fullNode}/fee`, {
        originalAmount: amountToTransfer,
        userHash,
        userSignature,
        feeIncluded,
        originalCurrencyHash,
      });

      return new BaseTransactionData(response.data.fullNodeFee);
    } catch (error) {
      throw getErrorMessage(error, `Error getting full node fees for amount ${amountToTransfer}`);
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
      throw getErrorMessage(error, 'Error getting network fee');
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
      throw getErrorMessage(error, 'Error in createMiniConsensus');
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
      throw getErrorMessage(error, 'Error getting trust score from trust score node');
    }
  }

  export async function sendTransaction(transaction: Transaction, network: Network = 'mainnet', fullnode?: string) {
    try {
      const response = await axios.put(`${fullnode || nodeUrl[network].fullNode}/transaction`, transaction);

      return response.data;
    } catch (error) {
      throw getErrorMessage(error, `Error sending transaction with hash ${transaction.getHash()}`);
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
      throw getErrorMessage(error, 'Error setting trust score at trust score node', 'message');
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
      throw getErrorMessage(error, 'Error update user type at trust score node', 'message');
    }
  }

  export async function getTokenHistory(
    currencyHash: string,
    userHash: string,
    indexedWallet: Wallet,
    api?: string,
    network: Network = 'mainnet'
  ): Promise<{ status: string; transactions: TransactionData[] }> {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const tokenCurrencies = new TokenHistorySignature({ instantTime: instantTimeMs, currencyHash });
    const signatureData = await tokenCurrencies.sign(indexedWallet, false);
    const payload = {
      userHash,
      currencyHash,
      createTime: instantTimeSeconds,
      signature: signatureData,
    };
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${api || nodeUrl[network].api}/currencies/token/history`, payload, { headers });

      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error get token history.', 'message');
    }
  }

  export async function getUserTokenCurrencies(
    userHash: string,
    indexedWallet: Wallet,
    api?: string,
    network: Network = 'mainnet'
  ): Promise<TokenCurrency[]> {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const tokenCurrencies = new TokenCurrenciesSignature(userHash, instantTimeMs);
    const signatureData = await tokenCurrencies.sign(indexedWallet, false);
    const payload = {
      userHash,
      createTime: instantTimeSeconds,
      signature: signatureData,
    };
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${api || nodeUrl[network].api}/currencies/token/user`, payload, { headers });

      return new TokenCurrenciesDto(data).userTokens;
    } catch (error) {
      throw getErrorMessage(error, 'Error get user token currencies', 'message');
    }
  }

  export async function getTokenDetails(currencyHash: string, userHash: string, indexedWallet: Wallet, api?: string, network: Network = 'mainnet') {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const tokenCurrencies = new TokenDetailsSignature({ userHash, instantTime: instantTimeMs, currencyHash });
    const signatureData = await tokenCurrencies.sign(indexedWallet, false);
    const payload = {
      userHash,
      currencyHash,
      createTime: instantTimeSeconds,
      signature: signatureData,
    };
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${api || nodeUrl[network].api}/currencies/token/details`, payload, { headers });

      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error get user token details', 'message');
    }
  }

  export async function getTokenDetailsBySymbol(
    currencySymbol: string,
    userHash: string,
    indexedWallet: Wallet,
    api?: string,
    network: Network = 'mainnet'
  ) {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const tokenCurrencies = new TokenDetailsSignature({ userHash, instantTime: instantTimeMs, currencySymbol });
    const signatureData = await tokenCurrencies.sign(indexedWallet, false);
    const payload = {
      userHash,
      symbol: currencySymbol,
      createTime: instantTimeSeconds,
      signature: signatureData,
    };
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${api || nodeUrl[network].api}/currencies/token/symbol/details`, payload, { headers });

      return data.token;
    } catch (error) {
      throw getErrorMessage(error, 'Error get user token details by symbol', 'message');
    }
  }

  export async function isNodeSupportMultiCurrencyApis(network: Network = 'mainnet', api?: string): Promise<HardForks> {
    try {
      const { data } = await axios.get(`${api || nodeUrl[network].api}/event/multi-dag/confirmed`);
      const hardFork = data?.transactionData;

      return hardFork ? HardForks.MULTI_CURRENCY : HardForks.SINGLE_CURRENCY;
    } catch (error) {
      throw getErrorMessage(error, 'Error get user token details', 'message');
    }
  }

  function getErrorMessage(error: any, debugMessage: string, fieldError = 'message') {
    const errorMessage = error.response && error.response.data ? error.response.data[fieldError] : error.message;

    return new NodeError(errorMessage, { debugMessage });
  }
}
