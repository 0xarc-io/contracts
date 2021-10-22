// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

// solhint-disable func-name-mixedcase

interface ICurve {

  function get_virtual_price()
    external
    view
    returns(uint256);

  function get_dy(
    int128 i,
    int128 j,
    uint256 dx
  )
    external
    view
    returns (uint256);
}
