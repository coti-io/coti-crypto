import axios from 'axios';
import { BaseTransactionData, SignatureData } from '..';
import { CotiError } from '../cotiError';
import { Network } from './utils';
import { TokenGenerationRequest, TokenMintFeeRequest, TokenMintQuoteFeeRequest } from './tokenUtils';

export type TokenMintingFeeQuoteResponse = {
  currencyHash: string;
  createTime: number;
  mintingAmount: number;
  mintingFee: number;
  signerHash: string;
  signature: SignatureData;
};

export namespace financeUtils {
  const financeServer = {
    mainnet: {
      api: 'https://mainnet-financialserver.coti.io',
    },
    testnet: {
      api: 'https://testnet-financialserver.coti.io',
    },
  };

  /**
   * Generates a new BaseTransactionData object representing the fee for generating a token with the specified TokenGenerationRequest.
   * @async
   * @param {TokenGenerationRequest} tokenGenerationRequest - The TokenGenerationRequest for which to calculate the fee.
   * @param {string} [financeServerUrl] - The URL of the finance server to use for the request. If omitted, the default finance server URL for the specified network will be used.
   * @param {Network} [network='mainnet'] - The network to use for the request. Defaults to 'mainnet'.
   * @returns {Promise<BaseTransactionData>} A new BaseTransactionData object representing the fee for generating the token.
   * @throws {Error} If there was an error generating the fee.
   */
  export async function getTokenGenerationFeeBT(
    tokenGenerationRequest: TokenGenerationRequest,
    financeServerUrl?: string,
    network: Network = 'mainnet'
  ): Promise<BaseTransactionData> {
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${financeServerUrl || financeServer[network].api}/admin/token/generate`, tokenGenerationRequest, {
        headers,
      });

      return new BaseTransactionData(data.tokenGenerationFee);
    } catch (error) {
      throw getErrorMessage(error);
    }
  }


  /**
   Send a request to get the token minting fee quote from the Finance server
   @async
   @function getTokenMintQuoteFee
   @param {TokenMintQuoteFeeRequest} tokenMintQuoteFeeRequest - An object containing the data required to make the request
   @param {string} [financeServerUrl] - Optional parameter to specify the Finance server URL to send the request to
   @param {Network} [network='mainnet'] - Optional parameter to specify the network to use. Defaults to 'mainnet'
   @returns {Promise<TokenMintingFeeQuoteResponse>} A Promise that resolves with the token minting fee quote
   @throws {Error} An error if the request fails
   */
  export async function getTokenMintQuoteFee(
    tokenMintQuoteFeeRequest: TokenMintQuoteFeeRequest,
    financeServerUrl?: string,
    network: Network = 'mainnet'
  ): Promise<TokenMintingFeeQuoteResponse> {
    try {
      const { data } = await axios.post(`${financeServerUrl || financeServer[network].api}/admin/token/mint/quote`, tokenMintQuoteFeeRequest);

      return data.mintingFeeQuote;
    } catch (error) {
      throw getErrorMessage(error);
    }
  }

  /**
   Calculates the minting fee for a token minting operation using a given token mint fee request object.
   @param {TokenMintFeeRequest} tokenMintFeeRequest - The token mint fee request object containing the necessary data to calculate the fee.
   @param {string} financeServerUrl - (optional) The URL of the finance server to use. Defaults to the mainnet finance server.
   @param {Network} network - (optional) The network to use. Defaults to 'mainnet'.
   @returns {Promise<BaseTransactionData>} - A Promise that resolves to a BaseTransactionData object representing the calculated minting fee.
   @throws {Error} - If there is an error with the request, an error message is thrown.
   */
  export async function getTokenMintFee(
    tokenMintFeeRequest: TokenMintFeeRequest,
    financeServerUrl?: string,
    network: Network = 'mainnet'
  ): Promise<BaseTransactionData> {
    try {
      const { data } = await axios.post(`${financeServerUrl || financeServer[network].api}/admin/token/mint/fee`, tokenMintFeeRequest);

      return data.tokenServiceFee;
    } catch (error) {
      throw getErrorMessage(error);
    }
  }

  export async function getWalletCurrencies(tokenHashes: string[], financeServerUrl?: string, network: Network = 'mainnet') {
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const { data } = await axios.post(`${financeServerUrl || financeServer[network].api}/currencies/wallet`, { tokenHashes }, { headers });

      return data.tokens;
    } catch (error) {
      throw getErrorMessage(error);
    }
  }

  function getErrorMessage(error: any, debugMessage?: string) {
    const errorMessage = error.response && error.response.data && error.response.data.message;

    return new CotiError(errorMessage, { debugMessage });
  }
}
