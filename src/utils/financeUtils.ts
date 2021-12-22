import axios from 'axios';
import { BaseTransactionData } from '..';
import { CotiError } from '../cotiError';
import { Network } from './utils';

export namespace financeUtils {
    export async function getTokenGenerationFeeBT(tokenGenerationRequest: any, financeNodeUrlUrl: string){
        const headers = {
          'Content-Type': 'application/json'
        };
    
        try {
            const { data } = await axios.post(`${financeNodeUrlUrl}/admin/token/generate`, tokenGenerationRequest, { headers });
    
            return new BaseTransactionData(data.tokenGenerationFee);
        } catch (error) {
          throw getErrorMessage(error);
        }
    }

    export async function getTokenMintQuoteFee(tokenMintQuoteFeeRequest: any, financeNodeUrl: string) {
        try {
            const { data } = await axios.post(`${financeNodeUrl}/admin/token/quote`, tokenMintQuoteFeeRequest);
      
            return data.mintingFeeQuote;
          } catch (error) {
            throw getErrorMessage(error);
          }
    }
    
    export async function getTokenMintFee(tokenMintFeeRequest: any, financeNodeUrl: string){
        try {
            const { data } = await axios.post(`${financeNodeUrl}/admin/token/mint/fee`, tokenMintFeeRequest);
    
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
        const { data } = await axios.post(`${financeNodeUrl}/currencies/wallet`, { tokenHashes }, { headers });

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