// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {StateV1} from "./StateV1.sol";

contract StorageV1 {

    bool public paused;

    StateV1 public state;

}
