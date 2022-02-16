// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

contract CredsStorage {

    /* ========== Public Variables ========== */

    mapping(address => uint256) public minterLimits;
    mapping(address => uint256) public minterIssued;

    /* ========== Internal Variables ========== */

    address[] internal _mintersArray;
}
