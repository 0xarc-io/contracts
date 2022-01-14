// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {KermanSocialMoney} from "../token/KermanERC20.sol";

contract MockKermanSocialMoney is KermanSocialMoney {
    // ============ Variables ============

    mapping(address => bool) public approvedCollateral;

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol,
        uint8         decimals,
        address       user
    )
        KermanSocialMoney(name, symbol, decimals, [uint256(0), uint256(0), uint256(0)], user, user, user)
    { } // solhint-disable-line

    // ============ Functions ============

    function mintShare(
        address to,
        uint256 value
    )
        public
    {
        _mint(to, value);
    }
}
