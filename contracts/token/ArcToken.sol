// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract ArcToken is BaseERC20, ISyntheticToken, Ownable {


    // ============ Constructor ============

    constructor() public BaseERC20("ARC Governance Token", "ARC") {}

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
