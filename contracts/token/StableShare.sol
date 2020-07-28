// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {BaseERC20} from "./BaseERC20.sol";


contract StableShare is BaseERC20 {
    // ============ Variables ============

    mapping(address => bool) public approvedCollateral;

    // ============ Constructor ============

    constructor() public BaseERC20("ARC Stable Share", "ALS") {}

    // ============ Functions ============

    function mintShare(
        address to,
        uint256 value
    )
        public
    {
        _mint(to, value);
    }

    function redeemShare(
        address from,
        uint256 value
    )
        public
    {
        _burn(from, value);
    }
}
