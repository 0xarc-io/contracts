// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {Sablier} from "../global/Sablier.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSablier is Sablier, MockTimestamp {/* solium-disable-line no-empty-blocks */}
