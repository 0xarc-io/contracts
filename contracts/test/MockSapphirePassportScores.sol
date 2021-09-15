// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { SapphirePassportScores } from "../sapphire/SapphirePassportScores.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

// solium-disable-next-line no-empty-blocks
contract MockSapphirePassportScores is SapphirePassportScores, MockTimestamp {

}
