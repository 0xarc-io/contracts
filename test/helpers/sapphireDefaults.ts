import { BigNumber, utils } from 'ethers';

export const DEFAULT_HIGH_C_RATIO = utils.parseEther('2');
export const DEFAULT_LOW_C_RATIO = utils.parseEther('1');

export const DEFAULT_PRICE = utils.parseEther('10');

export const DEFAULT_COLLATERAL_DECIMALS = BigNumber.from(6);
export const DEFAULT_STABLECOIN_DECIMALS = BigNumber.from(8);
export const DEFAULT_STABLE_COIN_PRECISION_SCALAR = utils.parseUnits(
  '1',
  BigNumber.from('18').sub(DEFAULT_STABLECOIN_DECIMALS),
);
export const DEFAULT_COLLATERAL_PRECISION_SCALAR = utils.parseUnits(
  '1',
  BigNumber.from('18').sub(DEFAULT_COLLATERAL_DECIMALS),
);

export const DEFAULT_TOTAL_BORROW_LIMIT = utils.parseEther('10000');

export const DEFAULT_VAULT_BORROW_MIN = BigNumber.from(0);
export const DEFAULT_VAULT_BORROW_MAXIMUM = utils.parseEther('5000');

export const DEFAULT_MAX_CREDIT_SCORE = BigNumber.from(1000);

