// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Amount} from "../lib/Amount.sol";

contract SyntheticStorageV1 {

    // Key properties of the synth itself
    uint8   internal _version;
    string  internal _name;
    string  internal _symbol;
    bytes32 internal _symbolKey;
    uint256 internal _totalSupply;

    // ERC20 properties
    mapping (address => uint256)                      internal _balances;
    mapping (address => mapping (address => uint256)) internal _allowances;

    // Minter properties
    address[]                            internal _mintersArray;
    mapping(address => bool)             internal _minters;
    mapping(address => uint256)          internal _minterLimits;
    mapping(address => Amount.Principal) internal _minterIssued;
}

contract SyntheticStorage is SyntheticStorageV1 { /* solium-disable-line no-empty-blocks */ }
