import { BigDecimal, Network } from './utils';
import * as cryptoUtils from './cryptoUtils';
import { FullNodeFeeSignature, TransactionTrustScoreSignature } from '../signature';
import { PrivateKey } from '../ecKeyPair';
import { nodeUtils } from './nodeUtils';
import { BaseTransaction, BaseTransactionName, BaseTransactionData } from '../baseTransaction';
import { Transaction } from '../transaction';

const amountRegex = /^\d+(\.\d{1,8})?$/;

type KeyPair = cryptoUtils.KeyPair;

export async function createTransaction(parameterObject: {
  userPrivateKey: string;
  inputMap: Map<string, number>;
  feeAddress?: string;
  destinationAddress: string;
  description?: string;
  network?: Network;
  feeIncluded?: boolean;
}) {
  const { userPrivateKey, inputMap, feeAddress, destinationAddress, description, network, feeIncluded = false } = parameterObject;

  if (!feeIncluded) {
    if (!feeAddress) throw new Error(`Missing fee address`);
    if (!cryptoUtils.verifyAddressStructure(feeAddress)) throw new Error(`Invalid fee address: ${feeAddress}`);
  }
  let feeAddressInInputMap = !feeAddress || inputMap.has(feeAddress);
  if (feeIncluded && !feeAddressInInputMap) throw new Error(`Fee address not found in inputs of fee included transaction`);

  let originalAmount = new BigDecimal('0');
  let addresses = [];

  inputMap.forEach((amount, address) => {
    if (!cryptoUtils.verifyAddressStructure(address)) throw new Error(`Invalid address: ${address}`);
    if (!amountRegex.test(amount.toString())) throw new Error(`Invalid amount ${amount} for address ${address}`);
    const decimalAmount = new BigDecimal(amount.toString());
    if (decimalAmount.compareTo(new BigDecimal('0')) <= 0) throw new Error(`Error sending transaction - input amount should be positive`);
    originalAmount = originalAmount.add(decimalAmount);
    amount = Number(decimalAmount.stripTrailingZeros().toString());
    addresses.push(address);
  });
  if (!feeIncluded && !feeAddressInInputMap) addresses.push(feeAddress!);

  const balanceObject = await nodeUtils.checkBalances(addresses, network);

  originalAmount = originalAmount.stripTrailingZeros();

  const privateKey = new PrivateKey(userPrivateKey);
  const keyPair = privateKey.keyPair;
  const userHash = privateKey.getPublicKey();

  let { fullNodeFee, networkFee } = await getFees(originalAmount, userHash, keyPair, feeIncluded, network);

  if (!feeIncluded) {
    const feeAmount = new BigDecimal(fullNodeFee.amount.toString()).add(new BigDecimal(networkFee.amount.toString()));
    if (feeAddressInInputMap) {
      const amount = inputMap.get(feeAddress!)!;
      const feeIncludedAmount = feeAmount.add(new BigDecimal(amount.toString())).stripTrailingZeros();
      inputMap.set(feeAddress!, Number(feeIncludedAmount.toString()));
    } else inputMap.set(feeAddress!, Number(feeAmount.stripTrailingZeros().toString()));
  }

  let baseTransactions: BaseTransaction[] = [];

  inputMap.forEach((amount, address) => {
    addInputBaseTranction(balanceObject, address, amount, baseTransactions);
  });

  networkFee = await nodeUtils.createMiniConsensus(userHash, fullNodeFee, networkFee, network);

  await addOutputBaseTransactions(originalAmount, fullNodeFee, networkFee, destinationAddress, baseTransactions, feeIncluded);

  const transaction = new Transaction(baseTransactions, description, userHash);

  await addTrustScoreToTransaction(transaction, userHash, keyPair, network);

  return transaction;
}

function getFullNodeFeeSignature(originalAmount: number, keyPair: KeyPair) {
  return new FullNodeFeeSignature(originalAmount).signByKeyPair(keyPair);
}

async function getFees(originalAmount: BigDecimal, userHash: string, keyPair: KeyPair, feeIncluded: boolean, network?: Network) {
  const originalAmountInNumber = Number(originalAmount.toString());
  const fullNodeFeeSignature = getFullNodeFeeSignature(originalAmountInNumber, keyPair);
  const fullNodeFee = await nodeUtils.getFullNodeFees(originalAmountInNumber, userHash, fullNodeFeeSignature, network, feeIncluded);
  const networkFee = await nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded);
  return { fullNodeFee, networkFee };
}

function addInputBaseTranction(balanceObject: any, address: string, amount: number, baseTransactions: BaseTransaction[]) {
  let { addressBalance, addressPreBalance } = balanceObject[address];
  const balance = new BigDecimal(`${addressBalance}`);
  const preBalance = new BigDecimal(`${addressPreBalance}`);
  const addressMaxAmount = preBalance.compareTo(balance) < 0 ? preBalance : balance;
  const decimalAmount = new BigDecimal(amount.toString());
  if (addressMaxAmount.compareTo(decimalAmount) < 0)
    throw new Error(
      `Error at create transaction - Trying to send ${decimalAmount}, current balance is ${addressMaxAmount}. Not enough balance in address: ${address}`
    );
  const spendFromAddress = decimalAmount.multiply(new BigDecimal('-1'));
  baseTransactions.push(new BaseTransaction(address, spendFromAddress, BaseTransactionName.INPUT));
}

function addOutputBaseTransactions(
  originalAmount: BigDecimal,
  fullNodeFee: BaseTransactionData,
  networkFee: BaseTransactionData,
  destinationAddress: string,
  baseTransactions: BaseTransaction[],
  feeIncluded: boolean
) {
  const amountRBT = feeIncluded
    ? originalAmount.subtract(new BigDecimal(fullNodeFee.amount)).subtract(new BigDecimal(networkFee.amount))
    : originalAmount;

  const RBT = new BaseTransaction(destinationAddress, amountRBT, BaseTransactionName.RECEIVER, undefined, undefined, originalAmount);
  const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeData(fullNodeFee);
  const transactionNetworkFee = BaseTransaction.getBaseTransactionFromFeeData(networkFee);

  baseTransactions.push(fullNodeTransactionFee);
  baseTransactions.push(transactionNetworkFee);
  baseTransactions.push(RBT);
}

function getTransactionTrustScoreSignature(transactionHash: string, keyPair: KeyPair) {
  return new TransactionTrustScoreSignature(transactionHash).signByKeyPair(keyPair, true);
}

async function addTrustScoreToTransaction(transaction: Transaction, userHash: string, keyPair: KeyPair, network?: Network) {
  const transactionHash = transaction.getHash();
  const transactionTrustScoreSignature = getTransactionTrustScoreSignature(transactionHash, keyPair);
  const transactionTrustScoreData = await nodeUtils.getTrustScoreForTransaction(transactionHash, userHash, transactionTrustScoreSignature, network);
  transaction.addTrustScoreMessageToTransaction(transactionTrustScoreData);
}
