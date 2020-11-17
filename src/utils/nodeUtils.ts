import axios from 'axios';
import { BaseAddress } from '../address';
import { BaseTransaction } from '../baseTransaction';
import { SignatureData } from '../signature';
import * as utils from './utils';

type Network = utils.Network;

const nodeUrl = {
  mainnet: {
    fullNode: 'https://mainnet-fullnode1.coti.io',
    trustScoreNode: 'https://mainnet-trustscore1.coti.io',
  },
  testnet: {
    fullNode: 'https://testnet-fullnode1.coti.io',
    trustScoreNode: 'https://testnet-trustscore1.coti.io',
  },
};

export async function getUserTrustScore(userHash: string, network: Network = 'mainnet') {
  try {
    return await axios.post(`${nodeUrl[network].trustScoreNode}/usertrustscore`, {
      userHash,
    });
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting user trust score, error: ${errorMessage}`);
  }
}

export async function sendAddressToNode(address: BaseAddress, network: Network = 'mainnet') {
  try {
    const { data } = await axios.put(`${nodeUrl[network].fullNode}/address`, { address: address.getAddressHex() });
    return data;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error sending address to fullnode: ${errorMessage}`);
  }
}

export async function checkAddressesExist(addressesToCheck: string[], network: Network = 'mainnet') {
  try {
    const { data } = await axios.post(`${nodeUrl[network].fullNode}/address`, { addresses: addressesToCheck });
    return data.addresses;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking existing addresses from fullnode: ${errorMessage}`);
  }
}

export async function checkBalances(addresses: string[], network: Network = 'mainnet') {
  try {
    const { data } = await axios.post(`${nodeUrl[network].fullNode}/balance`, { addresses });
    return data.addressesBalance;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking address balances from fullnode: ${errorMessage} for addresses: ${addresses}`);
  }
}

export async function getFullNodeFees(
  amountToTransfer: number,
  userHash: string,
  userSignature: SignatureData,
  network: Network = 'mainnet',
  feeIncluded?: boolean
) {
  try {
    const response = await axios.put(`${nodeUrl[network].fullNode}/fee`, {
      originalAmount: amountToTransfer,
      userHash,
      userSignature,
      feeIncluded,
    });
    return response.data.fullNodeFee;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting full node fees: ${errorMessage} for amount: ${amountToTransfer}`);
  }
}

export async function getNetworkFees(
  fullNodeFeeData: BaseTransaction,
  userHash: string,
  network: Network = 'mainnet',
  feeIncluded?: boolean
) {
  try {
    const response = await axios.put(`${nodeUrl[network].trustScoreNode}/networkFee`, {
      fullNodeFeeData,
      userHash,
      feeIncluded,
    });
    return response.data.networkFeeData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting network fee: ${errorMessage}`);
  }
}

export async function createMiniConsensus(
  userHash: string,
  fullNodeFeeData: BaseTransaction,
  networkFeeData: BaseTransaction,
  network: Network = 'mainnet'
) {
  const iteration = 3;
  let validationNetworkFeeMessage = {
    fullNodeFeeData,
    networkFeeData,
    userHash,
  };
  let response;
  try {
    for (let i = 1; i < iteration; i++) {
      response = await axios.post(`${nodeUrl[network].trustScoreNode}/networkFee`, validationNetworkFeeMessage);
      validationNetworkFeeMessage.networkFeeData = response.data.networkFeeData;
    }
    if (response && response.data) return { fullNodeFee: fullNodeFeeData, networkFee: response.data.networkFeeData };
    else throw new Error(`Error in createMiniConsensus: No response`);
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error in createMiniConsensus: ${errorMessage}`);
  }
}

export async function getTransactionTrustScore(
  userHash: string,
  transactionHash: string,
  userSignature: SignatureData,
  network: Network = 'mainnet'
) {
  const createTrustScoreMessage = {
    userHash,
    transactionHash,
    userSignature,
  };
  try {
    const response = await axios.post(
      `${nodeUrl[network].trustScoreNode}/transactiontrustscore`,
      createTrustScoreMessage
    );
    return response.data.transactionTrustScoreData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting trust score from trust score node: ${errorMessage}`);
  }
}
