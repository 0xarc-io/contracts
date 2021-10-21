// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IKeep3rV1 {

    function isKeeper(address) external returns (bool);

    function worked(address keeper) external;

    function bond(address bonding, uint amount) external;

    function activate(address bonding) external;
}
