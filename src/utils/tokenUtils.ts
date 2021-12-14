import { BaseTransactionData, cryptoUtils, CurrencyTypeDataSignature, MintQuoteDataSignature, MintQuoteFeeSignature, MintQuoteSignature, OriginatorSignature, utils, Wallet } from "..";
import axios from 'axios';

export namespace tokenUtils {
    export async function currenciesTokenGenerate(userHash:string, currencyName:string, currencySymbol:string, currencyType:string, description:string,
                                                  totalSupply:number, scale:number, currencyRateSourceType:string, rateSource:string, protectionModel:string,
                                                  seed: string, financeNode: string) {
      try {
            const instantTime = Number(new Date().getTime().toString().substring(0,10));
            const tokenGeneration = new OriginatorSignature(currencyName, currencySymbol, description, totalSupply, scale);
            const indexedWallet = new Wallet({ seed });
            const signatureData = await tokenGeneration.sign(indexedWallet, false);

            const instantTime2 = instantTime * 1000
            const tokenGeneration2 = new CurrencyTypeDataSignature(currencySymbol, currencyType, currencyRateSourceType, rateSource, protectionModel, instantTime2);
            const signatureData2 = await tokenGeneration2.sign(indexedWallet, false);

            const payload = {
              "originatorCurrencyData":
              {
                  "name": currencyName,
                  "symbol": currencySymbol,
                  "description": description,
                  "totalSupply": totalSupply,
                  "scale": scale,
                  "originatorHash": userHash,
                  "originatorSignature": signatureData
              },
              "currencyTypeData":
              {
                  "currencyType": "REGULAR_CMD_TOKEN",
                  "createTime": Math.round(instantTime),
                  "currencyRateSourceType": currencyRateSourceType,
                  "rateSource": rateSource,
                  "protectionModel": protectionModel,
                  "signerHash": userHash,
                  "signature": signatureData2
              }
            };

            const { data } = await axios.post(`${financeNode}/currencies/token/generate`, payload);

            return new BaseTransactionData(data.tokenGenerationFee);
      } catch (error) {
        throw error;
      }


    }
    export async function mintQuote(currencyHash: string, userHash: string, seed: string, mintingAmount: number, financeNode: string){
      const instantTime = Math.floor(new Date().getTime() / 1000);
      const instantTime2 = instantTime * 1000;
      const indexedWallet = new Wallet({ seed });
      const mintingQuote = new MintQuoteSignature(currencyHash, mintingAmount, instantTime2);
      const signatureData = await mintingQuote.sign(indexedWallet, false);
      
      const payload = {
        currencyHash,
        mintingAmount,
        createTime: instantTime,
        userHash,
        signature: signatureData
      };

      try{
        const { data } = await axios.post(`${financeNode}/currencies/token/mint/quote`, payload);
      
      return data.mintingFeeQuote;
      }
      catch(error){
        throw error;
      }
    }
    
    export async function getTokenMintFee(currencyHash: string, mintingAmount: number, feeAmount: number, walletAddressRecieveToken: string, userHash: string, seed: string, financeNode: string){
      const instantTime = Math.floor(new Date().getTime() / 1000);
      const instantTime2 = instantTime * 1000;
      const indexedWallet = new Wallet({ seed });

      const mintingQuote = new MintQuoteDataSignature(currencyHash, mintingAmount, feeAmount, walletAddressRecieveToken, instantTime2);
      const mintingQuoteSD = await mintingQuote.sign(indexedWallet, false);

      const mintingQuoteFee = new MintQuoteFeeSignature(instantTime2, currencyHash, mintingAmount, feeAmount);
      const mintingQuoteFeeSD = await mintingQuoteFee.sign(indexedWallet, false);


      const payload = {
        tokenMintingData: {
          mintingCurrencyHash: currencyHash,
          mintingAmount,
          receiverAddress: walletAddressRecieveToken,
          createTime: instantTime,
          feeAmount,
          signerHash: userHash,
          signature: mintingQuoteSD
        },
        mintingFeeQuoteData: {
          createTime: instantTime,
          mintingAmount,
          currencyHash,
          mintingFee: feeAmount,
          signerHash: userHash,
          signatureData: mintingQuoteFeeSD
        }
      }
      try{
        const { data } = await axios.post(`${financeNode}/currencies/token/mint/fee`, payload);
      
      return data.tokenServiceFee;
      }
      catch(error){
        throw error
      }

    }
}
