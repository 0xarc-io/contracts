// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Amount} from "../../lib/Amount.sol";

library SapphireTypes {

    struct ScoreProof {
        uint256 index;
        address account;
        uint256 score;
        bytes32[] merkleProof;
    }

}
