import axios from 'axios';
import { Signature } from '../signature';
import { BaseAddress } from '../baseAddress';

const FULL_NODE_URL = process.env.FULL_NODE_URL;
const TRUSTSCORE_URL = process.env.TRUSTSCORE_URL;

export async function getUserTrustScore(userHash: string) {
  try {
    return await axios.post(`${TRUSTSCORE_URL}/usertrustscore`, {
      userHash
    });
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting user trust score, error: ${errorMessage}`);
  }
}

export async function getAddressesOfWallet(wallet) {
  let addressesToCheck: string[] = [];
  let addressesThatExists: string[] = [];
  let nextChunk = 0;
  let notExistsAddressFound = false;

  while (!notExistsAddressFound) {
    for (let i = nextChunk; i < nextChunk + 20; i++) {
      addressesToCheck.push(wallet.generateAddressByIndex(i).getAddressHex());
    }
    let addressesResult = await checkAddressExists(addressesToCheck);
    addressesThatExists = addressesThatExists.concat(
      Object.keys(addressesResult).filter(x => addressesResult[x] === true)
    );
    notExistsAddressFound = Object.values(addressesResult).filter(val => val === false).length ? true : false;
    addressesToCheck = [];
    nextChunk = nextChunk + 20;
  }
  return addressesThatExists;
}

async function checkAddressExists(addressesToCheck: string[]) {
  try {
    const { data } = await axios.post(`${FULL_NODE_URL}/address`, { addresses: addressesToCheck });
    return data.addresses;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking existing addresses from fullnode: ${errorMessage}`);
  }
}

export async function sendAddressToNode(address: BaseAddress) {
  try {
    const { data } = await axios.put(`${FULL_NODE_URL}/address`, { address: address.getAddressHex() });
    return data;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error sending address to fullnode: ${errorMessage}`);
  }
}

export async function checkBalances(addresses: string[]) {
  try {
    const { data } = await axios.post(`${FULL_NODE_URL}/balance`, { addresses });
    return data.addressesBalance;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error checking address balances from fullnode: ${errorMessage} for addresses: ${addresses}`);
  }
}

export async function getFullNodeFees(Wallet, amountToTransfer: number) {
  try {
    const userHash = Wallet.generateUserPublicHash();
    const userSignature = new Signature.FullnodeFeeSignatue(amountToTransfer).sign(Wallet);
    const res = await axios.put(`${FULL_NODE_URL}/fee`, { originalAmount: amountToTransfer, userHash, userSignature });
    return res.data.fullNodeFee;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting full node fees: ${errorMessage} for amount: ${amountToTransfer}`);
  }
}

export async function getNetworkFees(fullNodeFeeData, userHash: string) {
  try {
    const res = await axios.put(`${TRUSTSCORE_URL}/networkFee`, { fullNodeFeeData, userHash });
    return res.data.networkFeeData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting network fee: ${errorMessage}`);
  }
}

export async function getTrustScoreFromTsNode(Wallet, userHash: string, transaction) {
  const transactionHash = transaction.createTransactionHash();
  const createTrustScoreMessage = {
    userHash,
    transactionHash,
    userSignature: Wallet.signMessage(transaction.createTransactionHash())
  };

  try {
    const res = await axios.post(`${TRUSTSCORE_URL}/transactiontrustscore`, createTrustScoreMessage);
    return res.data.transactionTrustScoreData;
  } catch (error) {
    const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
    throw new Error(`Error getting trust score from trust score node: ${errorMessage}`);
  }
}
