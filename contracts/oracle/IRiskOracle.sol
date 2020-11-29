// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IRiskOracle {

    function latestAnswer()
        public
        view
        returns (int256);

}
