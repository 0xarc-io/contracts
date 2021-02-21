// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;

contract ISapphireStrategy {

    function deposit(
        address token,
        uint256 amount,
        address from,
        address vault
    )
        public;

    function withdraw(
        address token,
        uint256 amount,
        address from,
        address vault
    )
        public;

    function rescue(
        address token,
        address to,
        uint256 amount,
        address vault
    )
        public;

}
