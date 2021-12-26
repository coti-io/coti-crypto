import axios from 'axios';
import { BaseTransactionData, SignatureData } from '..';
import { CotiError } from '../cotiError';
import { Network } from './utils';
import { TokenGenerationRequest, TokenMintFeeRequest, TokenMintQuoteFeeRequest } from './tokenUtils';



export type TokenMintingFeeQuoteResponse = {
  currencyHash: string,
  createTime: number,
  mintingAmount: number,
  mintingFee: number,
  signerHash: string,
  signature: SignatureData
};

export namespace financeUtils {

  const financialNode = {
    mainnet: {
      api: 'https://mainnet-financialnode.coti.io'
    },
    testnet: {
      api: 'https://testnet-financialnode.coti.io'
    }
  };

    export async function getTokenGenerationFeeBT(tokenGenerationRequest: TokenGenerationRequest, financeNodeUrl?: string, network: Network = 'mainnet'): Promise<BaseTransactionData>{
        const headers = {
          'Content-Type': 'application/json'
        };
    
        try {
            const { data } = await axios.post(`${financeNodeUrl || financialNode[network].api}/admin/token/generate`, tokenGenerationRequest, { headers });
    
            return new BaseTransactionData(data.tokenGenerationFee);
        } catch (error) {
          throw getErrorMessage(error);
        }
    }

    export async function getTokenMintQuoteFee(tokenMintQuoteFeeRequest: TokenMintQuoteFeeRequest, financeNodeUrl?: string, network: Network = 'mainnet'): Promise<TokenMintingFeeQuoteResponse> {
        try {
            const { data } = await axios.post(`${financeNodeUrl || financialNode[network].api}/admin/token/mint/quote`, tokenMintQuoteFeeRequest);
      
            return data.mintingFeeQuote;
          } catch (error) {
            throw getErrorMessage(error);
          }
    }
    
    export async function getTokenMintFee(tokenMintFeeRequest: TokenMintFeeRequest, financeNodeUrl?: string, network: Network = 'mainnet'): Promise<BaseTransactionData>{
        try {
            const { data } = await axios.post(`${financeNodeUrl || financialNode[network].api}/admin/token/mint/fee`, tokenMintFeeRequest);
    
            return data.tokenServiceFee;
        } catch (error) {
          throw getErrorMessage(error);
        }
    }

    export async function getWalletCurrencies(tokenHashes: string[], financeNodeUrl?: string, network: Network = 'mainnet') {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      try {
        const { data } = await axios.post(`${financeNodeUrl || financialNode[network].api}/currencies/wallet`, { tokenHashes }, { headers });

        return data;
      } catch (error) {
        throw getErrorMessage(error);
      }
    }

    function getErrorMessage(error: any, debugMessage?: string) {
      const errorMessage = error.response && error.response.data && error.response.data.message;
  
      return new CotiError(errorMessage, { debugMessage });
    }
}