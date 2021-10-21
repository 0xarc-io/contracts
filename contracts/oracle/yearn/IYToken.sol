// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IYToken {

    function getPricePerFullShare()
        external
        view returns (uint);

}
