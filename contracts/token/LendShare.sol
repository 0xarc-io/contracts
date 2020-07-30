// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {BaseERC20} from "./BaseERC20.sol";

contract LendShare is BaseERC20 {

    // ============ Variable ============

    address public arcAddress;

    // ============ Constructor ============

    constructor(
        address _arcAddress,
        string memory _name,
        string memory _symbol
    ) public BaseERC20(_name, _symbol) {
        arcAddress = _arcAddress;
    }

    // ============ Core Functions ============

    function mint(
        address to,
        uint256 value
    )
        public
    {
        require(
            msg.sender == arcAddress,
            "LendShare: only arc can mint"
        );

        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        public
    {
        require(
            msg.sender == arcAddress,
            "LendShare: only arc can burn"
        );

        _burn(to, value);
    }

}
