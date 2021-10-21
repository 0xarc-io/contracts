// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IMintableToken {

    function mint(
        address to,
        uint256 value
    )
        external;

    function burn(
        address to,
        uint256 value
    )
        external;

}
