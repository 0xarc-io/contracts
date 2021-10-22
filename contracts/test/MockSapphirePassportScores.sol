// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import { SapphirePassportScores } from "../sapphire/SapphirePassportScores.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

// solhint-disable-next-line no-empty-blocks
contract MockSapphirePassportScores is SapphirePassportScores, MockTimestamp {
     function currentTimestamp()
        public
        view
        override(SapphirePassportScores, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }
}
