import { BigDecimal, Network } from './utils';
import * as cryptoUtils from './cryptoUtils';
import { FullNodeFeeSignature } from '../signature';
import { PrivateKey } from '../ecKeyPair';
import { nodeUtils } from './nodeUtils';
import { BaseTransaction, BaseTransactionName, BaseTransactionObject } from '../baseTransaction';
import { Transaction } from '../transaction';

export async function createTransaction(parameterObject: {
  userPrivateKey: string;
  inputMap: Map<string, number>;
  feeAddress?: string;
  destinationAddress: string;
  description?: string;
  network?: Network;
  feeIncluded?: boolean;
}) {
  const { userPrivateKey, inputMap, feeAddress, destinationAddress, description = '', network, feeIncluded = false } = parameterObject;

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
    const decimalAmount = new BigDecimal(amount.toString());
    if (decimalAmount.compareTo(new BigDecimal('0')) <= 0) throw new Error(`Error sending transaction - input amount should be positive`);
    originalAmount = originalAmount.add(decimalAmount);
    addresses.push(address);
  });
  if (!feeIncluded && !feeAddressInInputMap) addresses.push(feeAddress!);

  const balanceObject = await nodeUtils.checkBalances(addresses);

  originalAmount = originalAmount.stripTrailingZeros();

  const privateKey = new PrivateKey(userPrivateKey);
  const keyPair = privateKey.keyPair;
  const userHash = privateKey.getPublicKey();
  const originalAmountInNumber = Number(originalAmount.toString());
  const fullNodeFeeSignature = new FullNodeFeeSignature(originalAmountInNumber).signByKeyPair(keyPair);
  const fullNodeFee: BaseTransactionObject = await nodeUtils.getFullNodeFees(
    originalAmountInNumber,
    userHash,
    fullNodeFeeSignature,
    network,
    feeIncluded
  );
  let networkFee = await nodeUtils.getNetworkFees(fullNodeFee, userHash, network, feeIncluded);

  if (!feeIncluded) {
    const feeAmount = new BigDecimal(fullNodeFee.amount.toString()).add(new BigDecimal(networkFee.amount.toString()));
    if (feeAddressInInputMap) {
      const amount = inputMap.get(feeAddress!)!;
      inputMap.set(feeAddress!, Number(feeAmount.add(new BigDecimal(amount.toString())).toString()));
    } else inputMap.set(feeAddress!, Number(feeAmount.toString()));
  }

  let baseTransactions = [];

  inputMap.forEach((amount, address) => {
    let { addressBalance, addressPreBalance } = balanceObject[address];
    const balance = new BigDecimal(`${addressBalance}`);
    const preBalance = new BigDecimal(`${addressPreBalance}`);
    const addressMaxAmount = preBalance.compareTo(balance) < 0 ? preBalance : balance;
    const decimalAmount = new BigDecimal(amount.toString());
    if (addressMaxAmount.compareTo(decimalAmount) < 0) throw new Error(`Error sending transaction -  Not enough balance in address: ${address}`);
    const spendFromAddress = decimalAmount.multiply(new BigDecimal('-1'));
    baseTransactions.push(new BaseTransaction(address, spendFromAddress, BaseTransactionName.INPUT));
  });

  networkFee = await nodeUtils.createMiniConsensus(userHash, fullNodeFee, networkFee, network);
  const amountRBT = feeIncluded
    ? originalAmount.subtract(new BigDecimal(fullNodeFee.amount)).subtract(new BigDecimal(networkFee.amount))
    : originalAmount;

  const RBT = new BaseTransaction(destinationAddress, amountRBT, BaseTransactionName.RECEIVER, undefined, undefined, originalAmount);
  const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeObject(fullNodeFee);
  const transactionNetworkFee = BaseTransaction.getBaseTransactionFromFeeObject(networkFee);

  baseTransactions.push(fullNodeTransactionFee);
  baseTransactions.push(transactionNetworkFee);
  baseTransactions.push(RBT);

  let transactionToSend = new Transaction(baseTransactions, description, userHash);
}
