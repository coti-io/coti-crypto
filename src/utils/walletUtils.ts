import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { BaseAddress, IndexedAddress } from '../address';
import { Transaction } from '../transaction';
import { IndexedWallet, BaseWallet } from '../wallet';
import { nodeUtils } from './nodeUtils';

export namespace walletUtils {
  export async function getUserTrustScore<T extends IndexedAddress>(wallet: IndexedWallet<T>) {
    return await nodeUtils.getUserTrustScore(wallet.getPublicHash(), wallet.getNetwork());
  }

  export async function sendAddressToNode(address: BaseAddress, wallet: BaseWallet) {
    return await nodeUtils.sendAddressToNode(address, wallet.getNetwork());
  }

  export async function getAddressesOfWallet<T extends IndexedAddress>(wallet: IndexedWallet<T>) {
    let addressesToCheck: string[] = [];
    let addressesThatExists: T[] = [];
    let nextChunk = 0;
    let notExistsAddressFound = false;
    const generatedAddressMap = new Map<string, T>();

    console.log(`Starting to check existed addresses in Coti network`);
    while (!notExistsAddressFound) {
      const indexes = Array.from({ length: 20 }, (v, k) => k + nextChunk);
      const addresses = await wallet.generateAddressesByIndex(indexes);
      for (const address of addresses) {
        generatedAddressMap.set(address.getAddressHex(), address);
        addressesToCheck.push(address.getAddressHex());
      }
      let addressesResult = await nodeUtils.checkAddressesExist(addressesToCheck, wallet.getNetwork());
      Object.keys(addressesResult)
        .filter(addressHex => addressesResult[addressHex] === true)
        .forEach(addressHex => {
          const generatedAddress = generatedAddressMap.get(addressHex);
          if (generatedAddress) addressesThatExists.push(generatedAddress);
        });
      notExistsAddressFound = Object.values(addressesResult).filter(val => val === false).length ? true : false;
      addressesToCheck = [];
      nextChunk = nextChunk + 20;
    }
    console.log(`Finished to check existed addresses in Coti network`);
    return addressesThatExists;
  }

  export async function checkBalances(addresses: string[], wallet: BaseWallet) {
    return await nodeUtils.checkBalances(addresses, wallet.getNetwork());
  }

  export async function getTransactionsHistory(addresses: string[], wallet: BaseWallet) {
    return await nodeUtils.getTransactionsHistory(addresses, wallet.getNetwork());
  }

  export async function getFullNodeFees<T extends IndexedAddress>(wallet: IndexedWallet<T>, amountToTransfer: number, feeIncluded?: boolean) {
    const userHash = wallet.getPublicHash();
    const userSignature = await new FullNodeFeeSignature(amountToTransfer).sign(wallet);
    const network = wallet.getNetwork();
    return await nodeUtils.getFullNodeFees(amountToTransfer, userHash, userSignature, network, feeIncluded);
  }

  export async function getTrustScoreForTransaction<T extends IndexedAddress>(wallet: IndexedWallet<T>, userHash: string, transaction: Transaction) {
    const transactionHash = transaction.getHash() || transaction.createTransactionHash();
    const userSignature = await new TransactionTrustScoreSignature(transactionHash).sign(wallet, true);
    const network = wallet.getNetwork();
    return await nodeUtils.getTrustScoreForTransaction(transactionHash, userHash, userSignature, network);
  }
}
