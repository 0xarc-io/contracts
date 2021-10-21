// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IRiskOracle {

    function latestAnswer()
        external
        view
        returns (int256);

}
