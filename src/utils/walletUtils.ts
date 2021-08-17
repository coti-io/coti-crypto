import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { BaseAddress, IndexedAddress } from '../address';
import { Transaction } from '../transaction';
import { IndexedWallet, BaseWallet } from '../wallet';
import { nodeUtils } from './nodeUtils';
import { BaseTransactionData } from '../baseTransaction';

export namespace walletUtils {
  export async function getUserTrustScore<T extends IndexedAddress>(wallet: IndexedWallet<T>) {
    const userHash = wallet.getPublicHash();
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return await nodeUtils.getUserTrustScore(userHash, network, trustScoreNode);
  }

  export async function sendAddressToNode(address: BaseAddress, wallet: BaseWallet) {
    return await nodeUtils.sendAddressToNode(address, wallet.getNetwork(), wallet.getFullNode());
  }

  export async function getAddressesOfWallet<T extends IndexedAddress>(wallet: IndexedWallet<T>, addressGap?: number) {
    let addressesToCheck: string[] = [];
    let addressesThatExists: T[] = [];
    let nextChunk = 0;
    let notExistsAddressFound = false;
    let maxAddressReached = false;
    const generatedAddressMap = new Map<string, T>();
    addressGap = addressGap || 20;
    console.log(`Getting wallet addresses from fullnode with addressGap ${addressGap}`);
    while (!notExistsAddressFound && !maxAddressReached) {
      const maxAddress = wallet.getMaxAddress();
      for (let i = nextChunk; i < nextChunk + addressGap; i++) {
        const address = await wallet.generateAddressByIndex(i);
        generatedAddressMap.set(address.getAddressHex(), address);
        addressesToCheck.push(address.getAddressHex());
        if (maxAddress && i === maxAddress) {
          maxAddressReached = true;
          break;
        }
      }
      let addressesResult = await nodeUtils.checkAddressesExist(addressesToCheck, wallet.getNetwork(), wallet.getFullNode());
      Object.keys(addressesResult)
        .filter(addressHex => addressesResult[addressHex] === true)
        .forEach(addressHex => {
          const generatedAddress = generatedAddressMap.get(addressHex);
          if (generatedAddress) addressesThatExists.push(generatedAddress);
        });
      notExistsAddressFound = Object.values(addressesResult).filter(val => val === false).length ? true : false;
      addressesToCheck = [];
      nextChunk = nextChunk + addressGap;
    }
    return addressesThatExists;
  }

  export async function checkBalances(addresses: string[], wallet: BaseWallet) {
    return await nodeUtils.checkBalances(addresses, wallet.getNetwork(), wallet.getFullNode());
  }

  export async function getTransactionsHistory(addresses: string[], wallet: BaseWallet) {
    return await nodeUtils.getTransactionsHistory(addresses, wallet.getNetwork(), wallet.getFullNode());
  }

  export async function getFullNodeFees<T extends IndexedAddress>(wallet: IndexedWallet<T>, amountToTransfer: number, feeIncluded?: boolean) {
    const userHash = wallet.getPublicHash();
    const userSignature = await new FullNodeFeeSignature(amountToTransfer).sign(wallet);
    const network = wallet.getNetwork();
    const fullnode = wallet.getFullNode();
    return await nodeUtils.getFullNodeFees(amountToTransfer, userHash, userSignature, network, feeIncluded, fullnode);
  }

  export async function getNetworkFees<T extends IndexedAddress>(wallet: IndexedWallet<T>, fullNodeFee: BaseTransactionData, feeIncluded?: boolean) {
    const userHash = wallet.getPublicHash();
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return await nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded, trustScoreNode);
  }

  export async function getTrustScoreForTransaction<T extends IndexedAddress>(wallet: IndexedWallet<T>, userHash: string, transaction: Transaction) {
    const transactionHash = transaction.getHash() || transaction.createTransactionHash();
    const userSignature = await new TransactionTrustScoreSignature(transactionHash).sign(wallet, true);
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return await nodeUtils.getTrustScoreForTransaction(transactionHash, userHash, userSignature, network, trustScoreNode);
  }
}
