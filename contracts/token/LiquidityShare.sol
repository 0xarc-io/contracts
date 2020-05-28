pragma solidity ^0.6.8;

import {BaseERC20} from "./BaseERC20.sol";


contract LiquidityShare is BaseERC20 {

    // ============ Variables ============

    // ============ Constructor ============

    constructor() public BaseERC20("ARC Liquidity Share", "ALS") {}

    // ============ Functions ============

    function mintShare() public {}

    function redeemShare() public {}
}
