// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IMozartSavingsV1 {

    function currentSavingsIndex()
        external
        view
        returns (uint256);

    function stake(
        uint256 amount
    )
        external
        returns (uint256);

    function unstake(
        uint256 amount
    )
        external
        returns (uint256);

    function updateIndex()
        external
        returns (uint256);
}
