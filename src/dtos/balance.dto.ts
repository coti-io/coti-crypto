export class BalanceDto {
  [address: string]: Balance;
}

export type Balance = {
  addressBalance: number;
  addressPreBalance: number;
};

export class TokensBalanceDto {
  [currencyHash: string]: BalanceDto;
}