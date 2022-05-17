import moment from 'moment';
import {
  CurrencyTypeDataSignature,
  MintQuoteDataSignature,
  MintQuoteFeeSignature,
  MintQuoteSignature,
  OriginatorSignature,
  SignatureData,
} from '../signature';
import { CurrencyTypeData, OriginatorCurrencyData } from '../transaction';
import { Wallet } from '../wallet';

export type TokenGenerationRequest = {
  originatorCurrencyData: OriginatorCurrencyData;
  currencyTypeData: CurrencyTypeData;
};

export type TokenMintQuoteFeeRequest = {
  currencyHash: string;
  createTime: number;
  mintingAmount: string;
  userHash: string;
  signature: SignatureData;
};

export type TokenMintData = {
  mintingCurrencyHash: string;
  mintingAmount: number;
  receiverAddress: string;
  createTime: number;
  feeAmount: number;
  signerHash: string;
  signature: SignatureData;
};

export type TokenMintingFeeQuoteData = {
  currencyHash: string;
  createTime: number;
  mintingAmount: number;
  mintingFee: number;
  signerHash: string;
  signature: SignatureData;
};

export type TokenMintFeeRequest = {
  tokenMintingServiceData: TokenMintData;
  mintingFeeQuoteData: TokenMintingFeeQuoteData;
};

export namespace tokenUtils {
  export async function getTokenGenerationFeeRequest(params: {
    userHash: string;
    currencyName: string;
    currencySymbol: string;
    currencyType: string;
    description: string;
    totalSupply: string;
    scale: number;
    currencyRateSourceType: string;
    rateSource: string;
    protectionModel: string;
    indexedWallet: Wallet;
  }): Promise<TokenGenerationRequest> {
    const {
      userHash,
      currencyName,
      currencySymbol,
      currencyType,
      description,
      totalSupply,
      scale,
      currencyRateSourceType,
      rateSource,
      protectionModel,
      indexedWallet,
    } = params;
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const originatorSignature = new OriginatorSignature(currencyName, currencySymbol, description, totalSupply, scale);
    const originatorSignatureData = await originatorSignature.sign(indexedWallet, false);
    const currencyTypeDataSignature = new CurrencyTypeDataSignature(
      currencySymbol,
      currencyType,
      currencyRateSourceType,
      rateSource,
      protectionModel,
      instantTimeMs
    );
    const currencyTypeDataSignatureData = await currencyTypeDataSignature.sign(indexedWallet, false);
    const originatorCurrencyData: OriginatorCurrencyData = {
      name: currencyName,
      symbol: currencySymbol,
      description: description,
      totalSupply,
      scale: scale,
      originatorHash: userHash,
      originatorSignature: originatorSignatureData,
    };
    const currencyTypeData: CurrencyTypeData = {
      currencyType: currencyType,
      createTime: instantTimeSeconds,
      currencyRateSourceType: currencyRateSourceType,
      rateSource: rateSource,
      protectionModel: protectionModel,
      signerHash: userHash,
      signature: currencyTypeDataSignatureData,
    };

    return {
      originatorCurrencyData,
      currencyTypeData,
    };
  }

  export async function getMintQuoteFeeRequest(
    currencyHash: string,
    userHash: string,
    indexedWallet: Wallet,
    mintingAmount: string
  ): Promise<TokenMintQuoteFeeRequest> {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const mintingQuote = new MintQuoteSignature(currencyHash, mintingAmount, instantTimeMs);
    const signatureData = await mintingQuote.sign(indexedWallet, false);
    return {
      currencyHash,
      mintingAmount,
      createTime: instantTimeSeconds,
      userHash,
      signature: signatureData,
    };
  }

  export async function getTokenMintFeeRequest(
    currencyHash: string,
    mintingAmount: number,
    feeAmount: number,
    walletAddressReceiveToken: string,
    userHash: string,
    indexedWallet: Wallet
  ): Promise<TokenMintFeeRequest> {
    const instantTimeSeconds = moment.utc().unix();
    const instantTimeMs = instantTimeSeconds * 1000;
    const mintingQuote = new MintQuoteDataSignature(currencyHash, mintingAmount, feeAmount, walletAddressReceiveToken, instantTimeMs);
    const mintingQuoteSD = await mintingQuote.sign(indexedWallet, false);
    const mintingQuoteFee = new MintQuoteFeeSignature(instantTimeMs, currencyHash, mintingAmount, feeAmount);
    const mintingQuoteFeeSD = await mintingQuoteFee.sign(indexedWallet, false);
    const tokenMintingServiceData: TokenMintData = {
      mintingCurrencyHash: currencyHash,
      mintingAmount,
      receiverAddress: walletAddressReceiveToken,
      createTime: instantTimeSeconds,
      feeAmount,
      signerHash: userHash,
      signature: mintingQuoteSD,
    };
    const mintingFeeQuoteData: TokenMintingFeeQuoteData = {
      createTime: instantTimeSeconds,
      mintingAmount,
      currencyHash,
      mintingFee: feeAmount,
      signerHash: userHash,
      signature: mintingQuoteFeeSD,
    };

    return {
      tokenMintingServiceData,
      mintingFeeQuoteData,
    };
  }
}
