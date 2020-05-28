pragma solidity ^0.6.8;

import {BaseERC20} from "./BaseERC20.sol";


contract SyntheticToken is BaseERC20 {
    // ============ Variable ============

    address public arcAddress;
    bytes32 public identifier;

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol,
        address _arcAddress,
        bytes32 _identifier
    ) public BaseERC20(_name, _symbol) {}

    // ============ Functions ============

    function mint() public {}

    function burn() public {}
}
