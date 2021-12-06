import keccak from "keccak";
import { cryptoUtils, utils } from "..";
import { generateRequestDTO } from "../generateRequest";
import { generateKeyPairFromSeed } from "./cryptoUtils";
import axios from 'axios';
import { hashAndSign } from './cryptoUtils';
import { numberToByteArray } from './utils';
import utf8 from 'utf8';

const financialNodeAddress = 'coti-financial-node.coti.io';
//TODO: find what value it should be in
const rateSource = "something"

export namespace tokenUtils {
    
    export async function currenciesTokenGenerate(userHash:string, privateKey:string, currencyName:string, currencySymbol:string, currencyType:string, description:string
      ,totalSupply:number, scale:number, currencyRateSourceType:string, rateSource:string, protectionModel:string) {
      try {
            const privateKeyBytes = utils.hexToBytes(privateKey);
            const message = `${encodeURIComponent(currencyName)}${encodeURIComponent(currencySymbol)}${encodeURIComponent(description)}${encodeURIComponent(totalSupply.toString())}${numberToByteArray(scale, 4)}`;
            const signatureData = hashAndSign(privateKeyBytes, message)
            const instantTime = new Date().getTime();

            const instantTime2 = instantTime * 1000
            const message2 = `${encodeURIComponent(currencySymbol)}${encodeURIComponent(currencyType)}${encodeURIComponent(currencyRateSourceType)}${encodeURIComponent(rateSource)}${encodeURIComponent(protectionModel)}${numberToByteArray(instantTime2, 8)}`;
            const signatureData2 = hashAndSign(privateKeyBytes, message2)

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
                  "createTime": instantTime,
                  "currencyRateSourceType": currencyRateSourceType,
                  "rateSource": rateSource,
                  "protectionModel": protectionModel,
                  "signerHash": userHash,
                  "signature": signatureData2
              }
            };

            const { data } = await axios.post(`https://${financialNodeAddress}/currencies/token/generate`, payload);

            return utf8.decode(data);
      } catch (error) {
        throw error;
      }


    }
    export async function mintQuote(currencyHash: string, userHash: string, privateKey: string, mintingAmount: number){
      const privateKeyBytes = utils.hexToBytes(privateKey);
      const instantTime = new Date().getTime();
      const instantTime2 = instantTime * 1000;
      const message = `${utils.hexToBytes(userHash)}${mintingAmount}${numberToByteArray(instantTime2, 8)}`;
      const signatureData = hashAndSign(privateKeyBytes, message);
      const payload = {
        currencyHash,
        mintingAmount,
        createTime: instantTime,
        signature: signatureData
      };

      const { data } = await axios.post(`https://${financialNodeAddress}/currencies/token/mint/quote`, payload);

      return utf8.decode(data);
    }
    export async function mint_fee(currencyHash: string, mintingAmount: number, feeAmount: number, walletAddressRecieveToken: string, userHash: string, privateKey: string){
      const privateKeyBytes = utils.hexToBytes(privateKey);
      const createTime = new Date().getTime();
      const instantTime = createTime * 1000;
      const message = `${utils.hexToBytes(currencyHash)}${mintingAmount}${feeAmount}${utils.hexToBytes(walletAddressRecieveToken)}${numberToByteArray(instantTime, 8)}`
      const signatureData = hashAndSign(privateKeyBytes, message);
      const message2 = `${numberToByteArray(createTime, 8)}${utils.hexToBytes(currencyHash)}${mintingAmount}${utf8.encode(`${feeAmount}`)}`
      const signatureData2 = hashAndSign(privateKeyBytes, message2);
      const payload = {
        tokenMintingData: {
          mintingCurrencyHash: currencyHash,
          mintingAmount,
          receiverAddress: walletAddressRecieveToken,
          createTime,
          feeAmount,
          signerHash: userHash,
          signature: signatureData
        },
        mintingFeeQuoteData: {
          createTime,
          mintingAmount,
          currencyHash,
          mintingFee: feeAmount,
          signerHash: userHash,
          signatureData: signatureData2
        }
      }

      const { data } = await axios.post(`https://${financialNodeAddress}/currencies/token/mint/fee`, payload);

      return utf8.decode(data);

    }
    export async function tokenGeneration(tokenGenrationFeeBaseTransaction: any, fullNodeFeeTransaction: any, trustScoreData: string[],
                          walletAddressIBT: string, userHash: string, seed: string){
      const TGFBT = tokenGenrationFeeBaseTransaction.tokenGenerationFee
      const FFBT = fullNodeFeeTransaction.fullNodeFee;
      const createTime = new Date().getTime();
      const instantTime = createTime * 1000;
      const TSD = trustScoreData;
      const IBTAddressHash = walletAddressIBT;
      FFBT.currencyHash = '';
      FFBT.Name = 'FFBT';
      const fullAmount = (+parseFloat(TGFBT.amount).toFixed(12)) + (+parseFloat(FFBT.amount).toFixed(12));
      const IBTAmount = -1 * fullAmount;

      const messageI = `${utils.hexToBytes(IBTAddressHash)}${IBTAmount}${numberToByteArray(createTime, 8)}${encodeURIComponent('generate token')}`;
      const IBT_Hash = keccak('keccak256').update(messageI).digest('hex');

      const messageT = `${IBT_Hash}${FFBT.hash}${TGFBT.hash}`;
      const hT = keccak('keccak256').update(messageT).digest('hex');

      const messageST = `${utils.hexToBytes(hT)}${encodeURIComponent('tokenGeneration')}${numberToByteArray(instantTime, 8)}${encodeURIComponent('generate token')}`;
      const privateKey = cryptoUtils.generateKeyPairFromSeed(seed).getPrivate('hex')
      
      const transactionSignature = hashAndSign(utils.hexToBytes(privateKey), messageST);
      
      const keyForAddress = generateKeyPairFromSeed(seed).getPrivate("hex");
      const ibtSignatureData = hashAndSign(utils.hexToBytes(keyForAddress), messageT);
      const IBT = {
        hash: IBT_Hash,
        currencyHash: FFBT.currencyHash,
        amount: IBTAmount,
        createTime: createTime,
        addressHash: walletAddressIBT,
        name: "IBT",
        SignatureData: ibtSignatureData
      }
      const baseTransaction = [IBT, FFBT, TGFBT];
      const payload = {
        hash: hT,
        baseTransaction: baseTransaction,
        transactionDescription: 'generate token',
        createTime,
        senderHash: userHash,
        senderSignature: transactionSignature,
        type: "TokenGeneration",
        trustedScoreResults: [TSD]
      }
      const headers = {
        'Content-Type': "application/json"
      };
  
      try {
        const { data } = await axios.put(`https://${financialNodeAddress}/transaction`, payload, { headers });
        return data;
      } catch (error) {
        throw error;
      }
    }
}
