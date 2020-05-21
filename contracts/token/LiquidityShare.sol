pragma solidity ^0.6.6;

import {BaseERC20} from "./BaseERC20.sol";


contract LiquidityShare is BaseERC20 {
    // ============ Variables ============

    mapping(address => bool) public approvedCollateral;

    // ============ Constructor ============

    constructor() public BaseERC20("ARC Liquidity Share", "ALS") {}

    // ============ Functions ============

    function mintShare() public {}

    function redeemShare() public {}
}
