import axios, { AxiosResponse } from 'axios';
import moment from 'moment';
import { BaseAddress } from '../address';
import { BaseTransactionData } from '../baseTransaction';
import { NodeError } from '../cotiError';
import { BalanceDto, TokensBalanceDto } from '../dtos/balance.dto';
import { TokenCurrenciesDto, TokenCurrency } from '../dtos/currencies.dto';
import { SignatureData, TokenCurrenciesSignature, TokenHistorySignature } from '../signature';
import { Transaction, TransactionData } from '../transaction';
import { Wallet } from '../wallet';
import { HardForks } from './transactionUtils';
import * as utils from './utils';
import {GetUserTrustScoreDto, SendAddressToNodeDto} from '../dtos/nodeUtils.dto';

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
  /**
   Retrieves the trust score of a given user in the Coti network.
   @param {string} userHash - The public hash of the user whose trust score will be retrieved.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} trustScoreNode - The URL of the trust score node to use. If not provided, the default trust score node for the specified network will be used.
   @returns {Promise<GetUserTrustScoreDto>} - A promise that resolves to a GetUserTrustScoreDto object containing the user's trust score.
   @throws {Error} - If there is an error retrieving the user's trust score.
   */
  export async function getUserTrustScore(userHash: string, network: Network = 'mainnet', trustScoreNode?: string): Promise<GetUserTrustScoreDto> {
    try {
      const { data } = await axios.post(`${trustScoreNode || nodeUrl[network].trustScoreNode}/usertrustscore`, {
        userHash,
      });
      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error getting user trust score');
    }
  }

  /**
   Sends a BaseAddress object to a full node in the Coti network.
   @param {BaseAddress} address - The address object to register.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<SendAddressToNodeDto>} - A promise that resolves to a SendAddressToNodeDto object containing the result of the operation.
   @throws {Error} - If there is an error sending the address to the full node.
   */
  export async function sendAddressToNode(address: BaseAddress, network: Network = 'mainnet', fullnode?: string): Promise<SendAddressToNodeDto> {
    try {
      const { data } = await axios.put(`${fullnode || nodeUrl[network].fullNode}/address`, { address: address.getAddressHex() });

      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error sending address to fullnode');
    }
  }

  /**
   Checks if a list of addresses registered in the Coti network.
   @param {string[]} addressesToCheck - An array of addresses to check if registered.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<string[]>} - A promise that resolves to an array of addresses that exist in the network.
   @throws {Error} - If there is an error checking the addresses.
   */
  export async function checkAddressesExist(addressesToCheck: string[], network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/address`, { addresses: addressesToCheck });

      return data.addresses;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking existing addresses from fullnode');
    }
  }

  /**
   Retrieves the balances for a list of addresses in the Coti network.
   @param {string[]} addresses - An array of addresses for which to retrieve balances.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<BalanceDto>} - A promise that resolves to a BalanceDto object containing the balances for each address.
   @throws {Error} - If there is an error retrieving the balances.
   */
  export async function checkBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string): Promise<BalanceDto> {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance`, { addresses });

      return data.addressesBalance;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking address balances from fullnode');
    }
  }

  /**
   Retrieves the token balances for a list of addresses in the Coti network.
   @param {string[]} addresses - An array of addresses for which to retrieve token balances.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<TokensBalanceDto>} - A promise that resolves to a TokensBalanceDto object containing the token balances for each address.
   @throws {Error} - If there is an error retrieving the token balances.
   */
  export async function getTokenBalances(addresses: string[], network: Network = 'mainnet', fullnode?: string): Promise<TokensBalanceDto> {
    try {
      const { data } = await axios.post(`${fullnode || nodeUrl[network].fullNode}/balance/tokens`, { addresses });

      return data.tokenBalances;
    } catch (error) {
      throw getErrorMessage(error, 'Error checking address token balances from fullnode');
    }
  }

  /**
   Retrieves a transaction by its hash from the Coti network.
   @param {string} transactionHash - The hash of the transaction to retrieve.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<TransactionData>} - A promise that resolves to a TransactionData object containing information about the transaction.
   @throws {Error} - If there is an error retrieving the transaction.
   */
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

  /**
   Retrieves none indexed transactions from the Coti network.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<TransactionData[]>} - A promise that resolves to an array of TransactionData objects containing information about the none indexed transactions.
   @throws {Error} - If there is an error retrieving the none indexed transactions.
   */
  export async function getNoneIndexTransactions(network: Network = 'mainnet', fullnode?: string) {
    try {
      const { data } = await axios.get(`${fullnode || nodeUrl[network].fullNode}/transaction/none-indexed`);

      return data.transactionsData;
    } catch (error) {
      throw getErrorMessage(error, `Error getting none indexed transactions from fullnode.`);
    }
  }

  /**
   Retrieves the transaction history for multiple addresses on the Coti network.
   @param {string[]} addresses - An array of addresses to retrieve the transaction history for.
   @param {Network} network - The network to use. Default is mainnet.
   @param {string} fullnode - The URL of the full node to use. If not provided, the default full node for the specified network will be used.
   @returns {Promise<Map<string, TransactionData>>} - A promise that resolves to a Map of address-TransactionData pairs containing information about the transaction history.
   @throws {Error} - If there is an error retrieving the transaction history.
   */
  export async function getTransactionsHistory(addresses: string[], network: Network = 'mainnet', fullnode?: string): Promise<Map<string, TransactionData>> {
    let response = await axios.post(`${fullnode || nodeUrl[network].fullNode}/transaction/addressTransactions/batch`, { addresses });
    return getMapFromTransactionHistoryResponse(response);
  }

  /**
   * Converts an Axios response object containing transaction data to a Map of transaction data.
   * @param response The Axios response object to convert.
   * @returns A Map of transaction data, with each transaction's hash as the key and the transaction data as the value.
   */
  function getMapFromTransactionHistoryResponse(response: AxiosResponse<any>): Map<string, TransactionData> {
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

  /**
   Retrieves the transaction history for a batch of addresses within a specified time range.
   Returns the transaction data as a Map object keyed by transaction hash.
   @param addresses An array of addresses to retrieve transaction history for.
   @param network The network to use, defaults to mainnet.
   @param fullnode The URL of the full node to use.
   @param startTime The start time of the time range in Unix epoch seconds, optional.
   @param endTime The end time of the time range in Unix epoch seconds, optional.
   @returns A Map object containing transaction data keyed by transaction hash.
   @throws Throws an error if there was an error retrieving transaction history from the full node.
   */
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

  /**
   * Retrieves the fees charged by the full node for a given transaction amount.
   * @param amountToTransfer - The amount to be transferred in the transaction.
   * @param userHash - The public hash of the user performing the transaction.
   * @param userSignature - The signature data of the user performing the transaction.
   * @param network - The network to use for the transaction. Defaults to 'mainnet'.
   * @param feeIncluded - Whether the transaction amount already includes fees. Defaults to false.
   * @param fullnode - The URL of the full node to use for the transaction.
   * @param originalCurrencyHash - The hash of the original currency used for the transaction.
   * @returns A promise that resolves to a `BaseTransactionData` object representing the fees charged by the full node.
   * @throws An error if there is an issue retrieving the fees from the full node.
   */
  export async function getFullNodeFees(
    amountToTransfer: string,
    userHash: string,
    userSignature: SignatureData,
    network: Network = 'mainnet',
    feeIncluded?: boolean,
    fullnode?: string,
    originalCurrencyHash?: string
  ): Promise<BaseTransactionData> {
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

  /**
   * Calculates the network fee for a transaction using the trust score node.
   * @param {BaseTransactionData} fullNodeFeeData - The data representing the full node fee.
   * @param {string} userHash - The user wallet public hash.
   * @param {Network} [network='mainnet'] - The network to use (mainnet or testnet).
   * @param {boolean} [feeIncluded] - Whether the fee is already included in the full node fee.
   * @param {string} [trustScoreNode] - The URL of the trust score node to use.
   * @returns {Promise<BaseTransactionData>} - A Promise that resolves with the calculated network fee data.
   * @throws {Error} - If there was an error getting the network fee.
   */
  export async function getNetworkFees(
    fullNodeFeeData: BaseTransactionData,
    userHash: string,
    network: Network = 'mainnet',
    feeIncluded?: boolean,
    trustScoreNode?: string
  ): Promise<BaseTransactionData>  {
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

  /**
   Creates a mini consensus process by sending multiple requests to the trust score node to validate the network fee.
   @param {string} userHash - The public hash of the user.
   @param {BaseTransactionData} fullNodeFeeData - The full node fee data.
   @param {BaseTransactionData} networkFeeData - The network fee data.
   @param {Network} [network='mainnet'] - The network to use. Default is 'mainnet'.
   @param {string} [trustScoreNode] - The trust score node to use. If not provided, the default node for the specified network will be used.
   @returns {BaseTransactionData} - The validated network fee data.
   @throws {Error} - Throws an error if there is an issue with the mini consensus process.
   */
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

  /**
   Get the trust score of a transaction from the trust score node.
   @param {string} transactionHash - The hash of the transaction.
   @param {string} userHash - The public hash of the user.
   @param {SignatureData} userSignature - The signature of the user.
   @param {Network} [network='mainnet'] - The name of the network to use (e.g. 'mainnet', 'testnet').
   @param {string} [trustScoreNode] - The URL of the trust score node to use (optional).
   @returns {Promise<number>} The trust score of the transaction.
   @throws {Error} If there is an error while getting the trust score.
   */
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

  /**
   Sends a transaction to the specified network using the specified full node.
   @param {Transaction} transaction - The transaction to be sent.
   @param {Network} network - The network to which the transaction will be sent. Default is 'mainnet'.
   @param {string} fullnode - The full node URL to which the transaction will be sent. If not specified, the default full node for the network will be used.
   @returns {Promise} - A promise that resolves with the response data from the server.
   @throws {Error} - If there was an error sending the transaction.
   */
  export async function sendTransaction(transaction: Transaction, network: Network = 'mainnet', fullnode?: string) {
    try {
      const response = await axios.put(`${fullnode || nodeUrl[network].fullNode}/transaction`, transaction);

      return response.data;
    } catch (error) {
      throw getErrorMessage(error, `Error sending transaction with hash ${transaction.getHash()}`);
    }
  }

  /**
   Returns the WebSocket URL for a specified network and fullnode.
   @param network - The network to connect to.
   @param fullnode - The fullnode to connect to (optional).
   @returns The WebSocket URL.
   */
  export function getSocketUrl(network: Network = 'mainnet', fullnode?: string) {
    return (fullnode || nodeUrl[network].fullNode) + '/websocket';
  }

  /**
   Sets the trust score of a user on the trust score node.
   @param {string} apiKey - The API key for the trust score node.
   @param {string} userHash - The public hash of the user whose trust score is to be set.
   @param {Network} [network='mainnet'] - The network on which the trust score is to be set.
   @param {string} [api] - The URL of the trust score node.
   @returns {number} The new trust score of the user.
   @throws {NodeError} If the API key is missing.
   @throws {ErrorMessage} If there is an error setting the trust score on the trust score node.
   */
  export async function setTrustScore(apiKey: string, userHash: string, network: Network = 'mainnet', api?: string): Promise<number> {
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

  /**
   Update the user type for a given user hash on the Trust Score node using an API key.
   @param apiKey - The API key for authentication with the Trust Score node.
   @param userHash - The user public hash of the user to update.
   @param network - The network to use (defaults to 'mainnet').
   @param userType - The new user type to set.
   @param api - The URL of the Trust Score node API (defaults to the URL for the specified network).
   @throws NodeError if the API key is missing.
   @throws any error thrown by axios or the Trust Score node.
   @returns a Promise that resolves to a string message indicating the success of the operation.
   */
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


  /**
   Gets the transaction history of a token currency for a given user
   @param currencyHash - The hash of the token currency
   @param userHash - The public hash of the user
   @param indexedWallet - The indexed wallet of the user
   @param api - The API URL to use for the request
   @param network - The network to use for the request
   @returns Promise containing an object with status and an array of TransactionData objects
   @throws {NodeError} if the API key is missing or if there is an error getting the token history
   */
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
      const { data } = await axios.post(`${api || nodeUrl[network].api}/currencies/token/history`, payload, {
        headers,
      });

      return data;
    } catch (error) {
      throw getErrorMessage(error, 'Error get token history.', 'message');
    }
  }

  /**
   * Returns the transaction history for a token currency owned by the specified user.
   * @param {string} currencyHash - The hash of the token currency.
   * @param {string} userHash - The user public hash.
   * @param {Wallet} indexedWallet - The indexed wallet to use for signing the request.
   * @param {string} [api] - The API URL to use. Uses default API URL for network if not provided.
   * @param {Network} [network='mainnet'] - The network to use.
   * @returns {Promise<{ status: string; transactions: TransactionData[] }>} - A promise that resolves with the transaction history of the specified token currency.
   * @throws {Error} - If an error occurs while fetching the token currency history.
   */
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

  /**
   * Retrieves the details of a specific token currency for a user.
   * @param {string} currencyHash - The hash of the token currency.
   * @param {string} userHash - The public hash of the user.
   * @param {Wallet} indexedWallet - The indexed wallet of the user.
   * @param {string} [api] - The URL of the API endpoint to use.
   * @param {Network} [network='mainnet'] - The network to use.
   * @returns {Promise<Object>} An object containing details of the token currency.
   * @throws {Error} If an API key is missing or an error occurs when fetching the token details.
   */
  export async function getTokenDetails(currencyHash: string, userHash: string, indexedWallet: Wallet, api?: string, network: Network = 'mainnet') {
    const payload = {
      currencyHash,
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

  /**
   * Get token details by symbol
   * @param {string} currencySymbol - The currency symbol
   * @param {string} userHash - The user hash
   * @param {Wallet} indexedWallet - The indexed wallet
   * @param {string} [api] - The API endpoint URL
   * @param {Network} [network='mainnet'] - The network
   * @returns {Promise<Object>} The token details
   * @throws {Error} If there was an error getting the token details by symbol
   */
  export async function getTokenDetailsBySymbol(
    currencySymbol: string,
    userHash: string,
    indexedWallet: Wallet,
    api?: string,
    network: Network = 'mainnet'
  ) {
    const payload = {
      symbol: currencySymbol,
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

  /**
   * Checks if the node supports multi-currency APIs.
   * @param {Network} network - The network to use. Default is 'mainnet'.
   * @param {string} api - The URL of the API endpoint. Optional.
   * @returns {Promise<HardForks>} - A promise that resolves with the type of hard fork the node supports.
   * @throws {Error} - Throws an error if there is an issue with the request.
   */
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
