// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireCore} from "../debt/sapphire/SapphireCoreV1.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSapphireCore is MockTimestamp, SapphireCore {}
