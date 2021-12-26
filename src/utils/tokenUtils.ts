import { IndexedWallet } from "..";
import { CurrencyTypeDataSignature, MintQuoteDataSignature, MintQuoteFeeSignature, MintQuoteSignature, OriginatorSignature, SignatureData } from "../signature";
import { CurrencyTypeData, OriginatorCurrencyData } from "../transaction";
import { Wallet } from "../wallet";

export type TokenGenerationRequest = {
  originatorCurrencyData: OriginatorCurrencyData,
  currencyTypeData: CurrencyTypeData
};

export type TokenMintQuoteFeeRequest = {
  currencyHash: string,
  createTime: number,
  mintingAmount: number,
  userHash: string,
  signature: SignatureData
};

export type TokenMintData = {
  mintingCurrencyHash: string,
  mintingAmount: number,
  receiverAddress: string,
  createTime: number,
  feeAmount: number,
  signerHash: string,
  signature: SignatureData
}

export type TokenMintingFeeQuoteData = {
  currencyHash: string,
  createTime: number,
  mintingAmount: number,
  mintingFee: number,
  signerHash: string,
  signature: SignatureData
};

export type TokenMintFeeRequest = {
  tokenMintingData: TokenMintData,
  mintingFeeQuoteData: TokenMintingFeeQuoteData
}

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
    indexedWallet: Wallet
  }): Promise<TokenGenerationRequest>{
    const { userHash, currencyName, currencySymbol, currencyType, description, totalSupply, scale, currencyRateSourceType, rateSource, protectionModel, indexedWallet } = params
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const tokenGeneration = new OriginatorSignature(currencyName, currencySymbol, description, totalSupply, scale);
    const signatureData = await tokenGeneration.sign(indexedWallet, false);
    const instantTime2 = instantTime * 1000
    const tokenGeneration2 = new CurrencyTypeDataSignature(currencySymbol, currencyType, currencyRateSourceType, rateSource, protectionModel, instantTime2);
    const signatureData2 = await tokenGeneration2.sign(indexedWallet, false);
    const originatorCurrencyData: OriginatorCurrencyData = 
    { 
      name: currencyName,
      symbol: currencySymbol,
      description: description,
      totalSupply: totalSupply,
      scale: scale,
      originatorHash: userHash,
      originatorSignature: signatureData
    };
    const currencyTypeData: CurrencyTypeData = {
      currencyType: currencyType,
      createTime: instantTime,
      currencyRateSourceType: currencyRateSourceType,
      rateSource: rateSource,
      protectionModel: protectionModel,
      signerHash: userHash,
      signature: signatureData2
    };
    
    const tokenGenerationFeeRequest = {
      originatorCurrencyData,
      currencyTypeData
    };

    return tokenGenerationFeeRequest;
  }

  export async function getMintQuoteFeeRequest(currencyHash: string, userHash: string, indexedWallet: Wallet, mintingAmount: number): Promise<TokenMintQuoteFeeRequest> {
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const instantTime2 = instantTime * 1000;
    const mintingQuote = new MintQuoteSignature(currencyHash, mintingAmount, instantTime2);
    const signatureData = await mintingQuote.sign(indexedWallet, false);
    const mintQuoteFeeRequest: TokenMintQuoteFeeRequest = {
      currencyHash,
      mintingAmount,
      createTime: instantTime,
      userHash,
      signature: signatureData
    };

    return mintQuoteFeeRequest;
  }

  export async function getTokenMintFeeRequest(currencyHash: string, mintingAmount: number, feeAmount: number, walletAddressRecieveToken: string, userHash: string, indexedWallet: Wallet): Promise<TokenMintFeeRequest> {
    const instantTime = Math.floor(new Date().getTime() / 1000);
    const instantTimeSeconds = instantTime * 1000;
    const mintingQuote = new MintQuoteDataSignature(currencyHash, mintingAmount, feeAmount, walletAddressRecieveToken, instantTimeSeconds);
    const mintingQuoteSD = await mintingQuote.sign(indexedWallet, false);
    const mintingQuoteFee = new MintQuoteFeeSignature(instantTimeSeconds, currencyHash, mintingAmount, feeAmount);
    const mintingQuoteFeeSD = await mintingQuoteFee.sign(indexedWallet, false);
    const tokenMintingData: TokenMintData = {
      mintingCurrencyHash: currencyHash,
      mintingAmount,
      receiverAddress: walletAddressRecieveToken,
      createTime: instantTime,
      feeAmount,
      signerHash: userHash,
      signature: mintingQuoteSD
    };
    const mintingFeeQuoteData: TokenMintingFeeQuoteData = {
        createTime: instantTime,
        mintingAmount,
        currencyHash,
        mintingFee: feeAmount,
        signerHash: userHash,
        signature: mintingQuoteFeeSD
      }

    return {
      tokenMintingData,
      mintingFeeQuoteData
    };
  }
}
