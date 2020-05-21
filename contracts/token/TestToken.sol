pragma solidity ^0.6.6;

import {BaseERC20} from "./BaseERC20.sol";


contract StableToken is BaseERC20 {
    // ============ Variables ============

    address public owner;
    mapping(address => bool) public approvedCollateral;

    // ============ Modifier ============

    modifier onlyOwner() {
        _;
    }

    // ============ Constructor ============

    constructor() public BaseERC20("Stable Token", "ST") {}

    // ============ Functions ============

    function mintShare() public onlyOwner {}

    function redeemShare() public onlyOwner {}
}
