// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { Sablier } from "../global/Sablier.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSablier is Sablier, MockTimestamp {/* solium-disable-line no-empty-blocks */}
