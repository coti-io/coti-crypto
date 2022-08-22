export class BalanceDto {
  [address: string]: Balance;
}

export type Balance = {
  addressBalance: string;
  addressPreBalance: string;
};

export class TokensBalanceDto {
  [currencyHash: string]: BalanceDto;
}