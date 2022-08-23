import axios from 'axios';
import { BaseTransactionData } from '..';
import { CotiError } from '../cotiError';
import { Network } from './utils';
import { TokenGenerationRequest, TokenMintFeeRequest, TokenMintQuoteFeeRequest } from './tokenUtils';
import { GetWalletCurrenciesResDto, TokenMintingFeeQuoteResponse } from '../dtos/financeUtils.dto';

export namespace financeUtils {
  const financeServer = {
    mainnet: {
      api: 'https://mainnet-financialserver.coti.io',
    },
    testnet: {
      api: 'https://testnet-financialserver.coti.io',
    },
  };

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

  export async function getWalletCurrencies(
    tokenHashes: string[],
    financeServerUrl?: string,
    network: Network = 'mainnet'
  ): Promise<GetWalletCurrenciesResDto> {
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

  function getErrorMessage(error: any, debugMessage?: string): CotiError {
    const errorMessage = error.response && error.response.data && error.response.data.message;

    return new CotiError(errorMessage, { debugMessage });
  }
}
