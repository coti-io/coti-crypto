export class  TokensBalanceDto {
  [address: string]: BalanceDto;
}

export type Balance = {
  addressBalance: number;
  addressPreBalance: number;
};

export class  CotiBalanceDto {
  [address: string]: Balance;
}

export class BalanceDto {
  [currencyHash: string]: Balance;
}
