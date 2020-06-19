pragma solidity ^0.6.8;

import {BaseERC20} from "./BaseERC20.sol";

contract SyntheticToken is BaseERC20 {

    // ============ Variable ============

    address public arcAddress;

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol,
        address _arcAddress
    ) public BaseERC20(_name, _symbol) {
        arcAddress = _arcAddress;
    }

    // ============ Functions ============

    function mint(
        address to,
        uint256 value
    ) public {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only arc can mint"
        );

        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    ) public {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only arc can mint"
        );

        _burn(to, value);
    }
}
