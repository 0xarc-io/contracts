// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { SapphireCreditScore } from "../debt/sapphire/SapphireCreditScore.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

// solium-disable-next-line no-empty-blocks
contract MockSapphireCreditScore is SapphireCreditScore, MockTimestamp {

}
