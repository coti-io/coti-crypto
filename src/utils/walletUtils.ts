import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { BaseAddress, IndexedAddress } from '../address';
import { Transaction, TransactionData } from '../transaction';
import { BaseWallet, IndexedWallet, Wallet } from '../wallet';
import { nodeUtils } from './nodeUtils';
import { BaseTransactionData } from '../baseTransaction';
import { BalanceDto, TokensBalanceDto } from '../dtos/balance.dto';
import { GetUserTrustScoreDto, SendAddressToNodeDto } from '../dtos/nodeUtils.dto';

export namespace walletUtils {

  /**
   Returns the trust score associated with a user on the COTI blockchain network
   @param {IndexedWallet<T>} wallet - The wallet to retrieve the user trust score for
   @returns {Promise<GetUserTrustScoreDto>} - The user trust score as a GetUserTrustScoreDto object
   */
  export async function getUserTrustScore<T extends IndexedAddress>(wallet: IndexedWallet<T>): Promise<GetUserTrustScoreDto> {
    const userHash = wallet.getPublicHash();
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return nodeUtils.getUserTrustScore(userHash, network, trustScoreNode);
  }

  /**
   Register the address
   @param {BaseAddress} address - The address to register
   @param {BaseWallet} wallet - The wallet to use for register the address
   @returns {Promise<SendAddressToNodeDto>} - The response received from the node as a SendAddressToNodeDto object
   */
  export async function sendAddressToNode(address: BaseAddress, wallet: BaseWallet): Promise<SendAddressToNodeDto> {
    return nodeUtils.sendAddressToNode(address, wallet.getNetwork(), wallet.getFullNode());
  }

  /**
   * Generates a specified number of addresses for a given wallet and checks which of those addresses registered.
   * Stop condition is one of the addresses is not registered.
   * @async
   * @param {IndexedWallet<T>} wallet - The wallet for which to generate addresses.
   * @param {number} [addressGap=20] - The number of addresses to generate at a time (default is 20).
   * @returns {Promise<T[]>} - An array of indexed addresses that were registered.
   */
  export async function getAddressesOfWallet<T extends IndexedAddress>(wallet: IndexedWallet<T>, addressGap?: number): Promise<T[]> {
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
        if (maxAddress && i === maxAddress) {
          maxAddressReached = true;
          break;
        }
        const address = await wallet.generateAddressByIndex(i);
        generatedAddressMap.set(address.getAddressHex(), address);
        addressesToCheck.push(address.getAddressHex());
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

  /**
   * Generates a specified number of addresses for a given wallet and checks which of those addresses registered.
   * Gets minimum & max address index and make sure the range are registered if not it register them.
   * Stop condition is address index in bulk is not registered.
   *
   * @async
   * @param {IndexedWallet<T>} wallet - The wallet for which to generate addresses.
   * @param {number} [bulkSize=20] - The number of addresses to generate at a time (default is 20).
   * @returns {Promise<T[]>} - An array of indexed addresses that were registered.
   */
  export async function autoDiscoverV(wallet: Wallet, bulkSize: number = 20): Promise<IndexedAddress[]> {
    const isWalletAutoSyncEnabled = wallet.getAutoSync();
    if(!isWalletAutoSyncEnabled) {
      console.log(`[initialAddressesSync] Skipping autoSync is false`);
      return [];
    }
    let addressesThatExists: IndexedAddress[] = [];
    let offset = 0;
    let isAddressesBulkNotRegistered = false;
    let maxAddressReached = false;
    const generatedAddressMap = new Map<string, IndexedAddress>();
    console.log(`Getting wallet addresses from fullnode with bulks of ${bulkSize}`);
    const addressHexToIndexMap = new Map<string, { index: number; isRegisteredAddress: boolean }>();
    let isMaxBulkIndexKnownByFN = true;
    let maxIndexRegistered;
    while (!isAddressesBulkNotRegistered && !maxAddressReached && isMaxBulkIndexKnownByFN) {
      const maxAddress = wallet.getMaxAddress();
      const latestBulkAddress = (await wallet.generateAddressByIndex(offset + bulkSize - 1)).getAddressHex();
      for (let i = offset; i < offset + bulkSize; i++) {
        if (maxAddress && i === maxAddress) {
          maxAddressReached = true;
          break;
        }
        const address = await wallet.generateAddressByIndex(i);
        generatedAddressMap.set(address.getAddressHex(), address);
        addressHexToIndexMap.set(address.getAddressHex(), { index: i, isRegisteredAddress: false });
      }
      let addressesResult = await nodeUtils.checkAddressesExist(Array.from(generatedAddressMap.keys()), wallet.getNetwork(), wallet.getFullNode());
      isMaxBulkIndexKnownByFN = addressesResult[latestBulkAddress];
      let minimumIndexNotRegistered;

      for (const [addressHex, isRegistered] of Object.entries(addressesResult)) {
        const address = addressHexToIndexMap.get(addressHex);
        if (!address) continue;
        if ((!minimumIndexNotRegistered || address.index < minimumIndexNotRegistered) && !isRegistered) minimumIndexNotRegistered = address.index;
        if (isRegistered && (!maxIndexRegistered || address.index > maxIndexRegistered)) {
          maxIndexRegistered = address.index;
        }
      }

      //generating missing addresses
      if (minimumIndexNotRegistered && maxIndexRegistered && minimumIndexNotRegistered < maxIndexRegistered) {
        for (let minimumIndexToRegister = minimumIndexNotRegistered; minimumIndexToRegister <= maxIndexRegistered; minimumIndexToRegister++) {
          await wallet.generateAndSetAddressByIndex(minimumIndexToRegister, true);
        }
      }

     Object.keys(addressesResult)
        .filter(addressHex => addressesResult[addressHex] === true)
        .forEach(addressHex => {
          const generatedAddress = generatedAddressMap.get(addressHex);
          if (generatedAddress) addressesThatExists.push(generatedAddress);
        });
      isAddressesBulkNotRegistered = !!Object.values(addressesResult).filter(val => val === false).length;
      offset = offset + bulkSize;
    }
    return addressesThatExists;
  }

  /**
   This function checks the balances of multiple addresses on a blockchain network.
   @async
   @param {string[]} addresses - An array of strings containing the addresses to check the balances of.
   @param {BaseWallet} wallet - An object of type BaseWallet containing the network and full node information.
   @returns {Promise<BalanceDto>} - A Promise that resolves to an object of type BalanceDto containing the balances of the given addresses.
   @throws {Error} - Throws an error if there is an issue with the network connection or if the provided addresses are invalid.
   @example
   const addresses = ['0361...', 'a575...'];
   const wallet = new Wallet({seed});
   const balances = await checkBalances(addresses, wallet);
   */
  export async function checkBalances(addresses: string[], wallet: BaseWallet): Promise<BalanceDto> {
    return nodeUtils.checkBalances(addresses, wallet.getNetwork(), wallet.getFullNode());
  }

  /**
   This function checks the token balances of multiple addresses on a blockchain network.
   @param {string[]} addresses - An array of strings containing the addresses to check the balances of.
   @param {BaseWallet} wallet - An object of type BaseWallet containing the network and full node information.
   @returns {Promise<TokensBalanceDto>} - A Promise that resolves to an object of type TokensBalanceDto containing the token balances of the given addresses.
   @throws {Error} - Throws an error if there is an issue with the network connection or if the provided addresses are invalid.
   @example
   const addresses = ['0361...', 'a575...'];
   const wallet = new Wallet({seed});
   const tokenBalances = await checkTokenBalances(addresses, wallet);
   */
  export async function checkTokenBalances(addresses: string[], wallet: BaseWallet): Promise<TokensBalanceDto> {
    return nodeUtils.getTokenBalances(addresses, wallet.getNetwork(), wallet.getFullNode());
  }

  /**
   * Returns the transaction history for the specified addresses.
   *
   * @param addresses An array of wallet addresses to retrieve the transaction history for.
   * @param wallet The wallet object that will be used to retrieve the transaction history.
   * @returns A Map object that maps each address to its transaction data, represented by a TransactionData object.
   */
  export async function getTransactionsHistory(addresses: string[], wallet: BaseWallet): Promise<Map<string, TransactionData>> {
    return nodeUtils.getTransactionsHistory(addresses, wallet.getNetwork(), wallet.getFullNode());
  }

  /**

   Returns the fees associated with a transaction on the COTI blockchain network
   @param {IndexedWallet<T>} wallet - The wallet to sign the fee with
   @param {string} amountToTransfer - The amount of the transaction in string format
   @param {boolean} [feeIncluded] - Whether the fees are already included in the transaction amount
   @param {string} [currencyHash] - The hash of the currency to use for the transaction
   @returns {Promise<BaseTransactionData>} - The fees associated with the transaction in BaseTransactionData format
   */
  export async function getFullNodeFees<T extends IndexedAddress>(
    wallet: IndexedWallet<T>,
    amountToTransfer: string,
    feeIncluded?: boolean,
    currencyHash?: string
  ): Promise<BaseTransactionData> {
    const userHash = wallet.getPublicHash();
    const userSignature = await new FullNodeFeeSignature(amountToTransfer, currencyHash).sign(wallet);
    const network = wallet.getNetwork();
    const fullnode = wallet.getFullNode();
    return nodeUtils.getFullNodeFees(amountToTransfer, userHash, userSignature, network, feeIncluded, fullnode, currencyHash);
  }

  /**
   Returns the network fees associated with a transaction on the COTI blockchain network
   @param {IndexedWallet<T>} wallet - The wallet to use for the transaction
   @param {BaseTransactionData} fullNodeFee - The full node fees associated with the transaction
   @param {boolean} [feeIncluded] - Whether the fees are already included in the transaction amount
   @returns {Promise<BaseTransactionData>} - The network fees associated with the transaction in BaseTransactionData format
   */
  export async function getNetworkFees<T extends IndexedAddress>(
    wallet: IndexedWallet<T>,
    fullNodeFee: BaseTransactionData,
    feeIncluded?: boolean
  ): Promise<BaseTransactionData> {
    const userHash = wallet.getPublicHash();
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded, trustScoreNode);
  }

  /**
   Returns the trust score associated with a transaction on the COTI blockchain network
   @param {IndexedWallet<T>} wallet - The wallet to sign the trust score with
   @param {string} userHash - The public hash of the user associated with the transaction
   @param {Transaction} transaction - The transaction to retrieve the trust score for
   @returns {Promise<number>} - The trust score associated with the transaction as a number
   */
  export async function getTrustScoreForTransaction<T extends IndexedAddress>(wallet: IndexedWallet<T>, userHash: string, transaction: Transaction): Promise<number> {
    const transactionHash = transaction.getHash() || transaction.createTransactionHash();
    const userSignature = await new TransactionTrustScoreSignature(transactionHash).sign(wallet, true);
    const network = wallet.getNetwork();
    const trustScoreNode = wallet.getTrustScoreNode();
    return nodeUtils.getTrustScoreForTransaction(transactionHash, userHash, userSignature, network, trustScoreNode);
  }
}
