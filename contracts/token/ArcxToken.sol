// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {Ownable} from "../lib/Ownable.sol";

import {IMintableToken} from "../token/IMintableToken.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract ArcxToken is BaseERC20, IMintableToken, Ownable {

    // ============ Constructor ============

    constructor()
        public
        BaseERC20("ARC Governance Token", "ARCX")
    { }

    // ============ Core Functions ============

    function mint(
        address to,
        uint256 value
    )
        external
        onlyOwner
    {
        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        external
        onlyOwner
    {
        _burn(to, value);
    }

}
