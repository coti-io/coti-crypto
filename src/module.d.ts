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
