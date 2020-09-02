// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract SyntheticToken is BaseERC20, ISyntheticToken {

    // ============ Variable ============

    address public arcAddress;

    bytes32 private _symbolKey;

    // ============ Modifier ============

    modifier onlyArc() {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only callable by ARC"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        address _arcAddress,
        string memory _name,
        string memory _symbol
    )
        public
        BaseERC20(_name, _symbol)
    {
        arcAddress = _arcAddress;
        _symbolKey = keccak256(
            abi.encode(_symbol)
        );
    }

    function symbolKey()
        external
        view
        returns (bytes32)
    {
        return _symbolKey;
    }

    // ============ Core Functions ============

    function mint(
        address to,
        uint256 value
    )
        external
        onlyArc
    {
        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        external
        onlyArc
    {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only arc can burn"
        );

        _burn(to, value);
    }

    function transferCollateral(
        address token,
        address to,
        uint256 value
    )
        external
        onlyArc
        returns (bool)
    {
        return BaseERC20(token).transfer(
            to,
            value
        );
    }

}
