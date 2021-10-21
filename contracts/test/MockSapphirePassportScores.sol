// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { SapphirePassportScores } from "../sapphire/SapphirePassportScores.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

// solhint-disable-next-line no-empty-blocks
contract MockSapphirePassportScores is SapphirePassportScores, MockTimestamp {

}
