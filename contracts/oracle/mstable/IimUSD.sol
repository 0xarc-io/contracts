// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IimUSD {

    function creditsToUnderlying(uint256 _credits)
      external
      view
      returns(uint256);
}
