// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { SapphireCreditScore } from "../debt/sapphire/SapphireCreditScore.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSapphireCreditScore is SapphireCreditScore, MockTimestamp {
    constructor(bytes32 merkleRoot, address _merkleRootUpdater, address _pauseOperator)
        public
        SapphireCreditScore(merkleRoot, _merkleRootUpdater, _pauseOperator, 1000)
    { }
}
