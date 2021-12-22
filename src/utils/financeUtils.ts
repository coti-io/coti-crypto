import axios from "axios";
import { BaseTransactionData } from "..";
import { Network } from "./utils";

export namespace financeUtils {
    export async function getTokenGenerationFeeBT(tokenGenerationRequest: any, financeNodeUrlUrl: string){
     
        const headers = {
          'Content-Type': "application/json"
        };
    
        try {
            const { data } = await axios.post(`${financeNodeUrlUrl}/currencies/token/generate`, tokenGenerationRequest, { headers });
    
            return new BaseTransactionData(data.tokenGenerationFee);
        } catch (error) {
          const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
          throw new Error(errorMessage);
        }
    }

    export async function getTokenMintQuoteFee(tokenMintQuoteFeeRequest: any, financeNodeUrl: string){
        try {
            const { data } = await axios.post(`${financeNodeUrl}/currencies/token/mint/quote`, tokenMintQuoteFeeRequest);
      
            return data.mintingFeeQuote;
          } catch (error) {
            throw new Error(error.response.data.message);
          }
    }
    
    export async function getTokenMintFee(tokenMintFeeRequest: any, financeNodeUrl: string){
        try {
            const { data } = await axios.post(`${financeNodeUrl}/currencies/token/mint/fee`, tokenMintFeeRequest);
    
            return data.tokenServiceFee;
    
        } catch (error) {
            throw new Error(error.response.data.message);
        }
    }

    export async function getTokensDetails(tokenHashes: string[], financeNodeUrl?: string, network: Network = 'mainnet') {
      const headers = {
        'Content-Type': "application/json"
      };
      
      try {
        const { data } = await axios.post(`${financeNodeUrl}/currencies/wallet`, { tokenHashes }, { headers });
        return data;
      } catch (error) {
        throw new Error(error.response.data.message);
      }
    }
  
    
}