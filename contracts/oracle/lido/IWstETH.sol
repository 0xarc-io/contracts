// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20} from "../../token/IERC20.sol";

interface IWstETH {
    /**
     * @return Returns amount of stETH for 1 wstETH
     */
    function stEthPerToken()
        external
        view
        returns (uint256);
}
