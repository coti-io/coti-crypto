declare module 'blakejs';
declare module '@ledgerhq/logs' {
  export type Log = {
    type: string;
    message?: string;
    data?: any;
    id: string;
    date: Date;
  };

  export type Unsubscribe = () => void;

  export function listen(cb: (log: Log) => void): Unsubscribe;
}
declare module '@ledgerhq/hw-transport-webhid' {
  import Transport, { Descriptor } from '@ledgerhq/hw-transport';

  export class HIDDevice {
    opened: boolean;
    vendorId: number;
    productId: number;
    productName: string;
  }

  export default class TransportWebHID extends Transport {
    device: HIDDevice;

    constructor(device: HIDDevice);

    static open(device: HIDDevice): Promise<TransportWebHID>;
    static open(descriptor: Descriptor): Promise<TransportWebHID>;
  }
}
