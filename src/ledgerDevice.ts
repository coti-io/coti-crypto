import { EventEmitter } from 'events';
import { Descriptor, DescriptorEvent } from '@ledgerhq/hw-transport';
import * as ledgerUtils from './utils/ledgerUtils';

type LedgerTransportType = ledgerUtils.LedgerTransportType;

export interface LedgerEvent {
  on(event: 'add' | 'remove', listener: (ledgerEvent: DescriptorEvent<Descriptor>) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'add' | 'remove', ledgerEvent: DescriptorEvent<Descriptor>): boolean;
  emit(event: 'error', error: Error): boolean;
}

export abstract class LedgerEvent extends EventEmitter {
  public onAdd(listener: (ledgerEvent: DescriptorEvent<Descriptor>) => void): this {
    return this.on('add', listener);
  }

  public onRemove(listener: (ledgerEvent: DescriptorEvent<Descriptor>) => void): this {
    return this.on('remove', listener);
  }
}

export class LedgerDevice extends LedgerEvent {
  private transportType?: LedgerTransportType;

  constructor(transportType?: LedgerTransportType) {
    super();
    this.transportType = transportType;
  }

  listen() {
    ledgerUtils.listen({ next: this.next, error: this.error, complete: this.complete }, this.transportType);
  }

  next(event: DescriptorEvent<Descriptor>) {
    console.log(`Event`);
    console.log(event);
    //  this.emit(event.type, event);
  }

  error(error: Error) {
    console.log(`Error`);
    console.log(error);
    //  this.emit('error', error);
  }

  complete() {
    console.log(`Complete`);
    //  console.log('Complete');
  }
}
