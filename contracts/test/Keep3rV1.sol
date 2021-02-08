// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IKeep3rV1} from "../oracle/uniswap-twap/IKeep3rV1.sol";

contract Keep3rV1 is IKeep3rV1 {
    mapping(address => bool) public keepers;
}
