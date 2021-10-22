// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {BaseERC20} from "../token/BaseERC20.sol";

contract TestToken is BaseERC20 {
    // ============ Variables ============

    mapping(address => bool) public approvedCollateral;

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol,
        uint8         decimals
    )
        public
        BaseERC20(name, symbol, decimals)
    { }

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

    function approveOnBehalf(
        address _owner,
        address _spender,
        uint256 _amount
    )
        public
    {
        _approve(
            _owner,
            _spender,
            _amount
        );
    }
}
