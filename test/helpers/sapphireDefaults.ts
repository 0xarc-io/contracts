import { BigNumber, utils } from 'ethers';

export const DEFAULT_HiGH_C_RATIO = utils.parseEther('2');
export const DEFAULT_LOW_C_RATIO = utils.parseEther('1');

export const DEFAULT_PRICE = utils.parseEther('1');

export const DEFAULT_COLLATERAL_DECIMALS = BigNumber.from(6);
export const DEFAULT_COLLATERAL_LIMIT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);

export const DEFAULT_TOTAL_BORROW_LIMIT = utils.parseEther('10000');

export const DEFAULT_VAULT_BORROW_MIN = BigNumber.from(0);
export const DEFAULT_VAULT_BORROW_MAXIMUM = utils.parseEther('5000');
