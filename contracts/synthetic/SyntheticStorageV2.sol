// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {Amount} from "../lib/Amount.sol";

contract SyntheticStorageV2 {

    /**
     * @dev ERC20 Properties
     */
    string  internal _name;
    string  internal _symbol;
    uint256 internal _totalSupply;
    string  internal _version;

    /**
     * @dev _balances records the amounts minted to each user by each minter
     */
    mapping (address => uint256)                        internal _balances;
    mapping (address => mapping (address => uint256))   internal _allowances;

    /**
     * @dev Minter Properties
     */
    address[]                   internal _mintersArray;
    mapping(address => bool)    internal _minters;
    mapping(address => uint256) internal _minterLimits;
    mapping(address => uint256) internal _minterIssued;
}
