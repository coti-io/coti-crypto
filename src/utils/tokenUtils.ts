import { BaseTransactionData, CurrencyTypeDataSignature, MintQuoteDataSignature, MintQuoteFeeSignature, MintQuoteSignature, OriginatorSignature, Wallet } from "..";
import axios from 'axios';

export namespace tokenUtils {
  export async function getTokenGenerationFeeRequest(params: {
    userHash: string;
    currencyName: string,
    currencySymbol: string,
    currencyType: string,
    description: string,
    totalSupply: number,
    scale: number,
    currencyRateSourceType: string,
    rateSource: string,
    protectionModel: string,
    seed: string
  }) {
    const { userHash, currencyName, currencySymbol, currencyType, description, totalSupply, scale, currencyRateSourceType, rateSource, protectionModel, seed } = params
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const tokenGeneration = new OriginatorSignature(currencyName, currencySymbol, description, totalSupply, scale);
    const indexedWallet = new Wallet({ seed });
    const signatureData = await tokenGeneration.sign(indexedWallet, false);

    const instantTime2 = instantTime * 1000
    const tokenGeneration2 = new CurrencyTypeDataSignature(currencySymbol, currencyType, currencyRateSourceType, rateSource, protectionModel, instantTime2);
    const signatureData2 = await tokenGeneration2.sign(indexedWallet, false);

    const tokenGenerationFeeRequest = {
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
        "currencyType": currencyType,
        "createTime": Math.round(instantTime),
        "currencyRateSourceType": currencyRateSourceType,
        "rateSource": rateSource,
        "protectionModel": protectionModel,
        "signerHash": userHash,
        "signature": signatureData2
      }
    };

    return tokenGenerationFeeRequest;
  }

  export async function getMintQuoteFeeRequest(currencyHash: string, userHash: string, seed: string, mintingAmount: number) {
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const instantTime2 = instantTime * 1000;
    const indexedWallet = new Wallet({ seed });
    const mintingQuote = new MintQuoteSignature(currencyHash, mintingAmount, instantTime2);
    const signatureData = await mintingQuote.sign(indexedWallet, false);

    const mintQuoteRequest = {
      currencyHash,
      mintingAmount,
      createTime: instantTime,
      userHash,
      signature: signatureData
    };

    return mintQuoteRequest;
  }

  export async function getTokenMintFeeRequest(currencyHash: string, mintingAmount: number, feeAmount: number, walletAddressRecieveToken: string, userHash: string, seed: string): Promise<any> {
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const instantTime2 = instantTime * 1000;
    const indexedWallet = new Wallet({ seed });

    const mintingQuote = new MintQuoteDataSignature(currencyHash, mintingAmount, feeAmount, walletAddressRecieveToken, instantTime2);
    const mintingQuoteSD = await mintingQuote.sign(indexedWallet, false);

    const mintingQuoteFee = new MintQuoteFeeSignature(instantTime2, currencyHash, mintingAmount, feeAmount);
    const mintingQuoteFeeSD = await mintingQuoteFee.sign(indexedWallet, false);


    const tokenMintFeeRequest = {
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

    return tokenMintFeeRequest;


  }
}
