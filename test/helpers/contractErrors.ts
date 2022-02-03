export const UNDERCOLLATERALIZED_ERROR =
  'borrowPosition(): position is not collateralised';
export const ADMINABLE_ERROR = 'Adminable: caller is not admin';
export const REPAY_WITHDRAW_ERROR =
  'repay(): cannot withdraw more than allowed';
export const INTEREST_SETTER_ERROR =
  'D2CoreV1: only callable by interest setter';
export const LIQUIDATION_COLLATERALIZED_ERROR =
  'liquidatePosition(): position is collateralised';

export const ARITHMETIC_ERROR = '0x11'; // (Arithmetic operation underflowed or overflowed outside of an unchecked block)
export const TRANSFER_FROM_FAILED = 'SafeERC20: TRANSFER_FROM_FAILED';
