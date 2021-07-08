// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {BaseERC20} from "../token/BaseERC20.sol";

/**
 * @notice An ERC20 that allows users to deposit a given token, where their
 *         balance is expressed in forms of shares. This will expose users to the
 *         increase and decrease of the balance of the token on the contract.
 *
 *         To withdraw their balance, users must first express their withdrawal
 *         intent, which will trigger a cooldown after which they will be able
 *         to reclaim their share.
 */
contract StakingAccrualERC20 is BaseERC20 {

    constructor (
        string memory name,
        string memory symbol,
        uint8 decimals
    )
        public
        BaseERC20(name, symbol, decimals)
    {}

}
