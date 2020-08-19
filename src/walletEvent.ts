import { EventEmitter } from 'events';
import { BaseAddress } from './baseAddress';
import { Transaction } from './transaction';

export interface WalletEvent {
  on(event: 'balanceChange', listener: (address: BaseAddress) => void): this;
  on(event: 'generateAddress', listener: (address: BaseAddress) => void): this;
  on(event: 'receivedTransaction', listener: (transaction: Transaction) => void): this;

  emit(event: 'balanceChange', address: BaseAddress): boolean;
  emit(event: 'generateAddress', address: BaseAddress): boolean;
  emit(event: 'receivedTransaction', transaction: Transaction): boolean;
}

export class WalletEvent extends EventEmitter {}
