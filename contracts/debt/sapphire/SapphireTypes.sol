// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Amount} from "../../lib/Amount.sol";

library SapphireTypes {

    struct ScoreProof {
        address account;
        uint256 score;
        bytes32[] merkleProof;
    }

    struct CreditScore {
        uint256 score;
        uint256 lastUpdated;
    }

    struct Position {
        Amount.Principal collateralAmount;
        Amount.Principal borrowedAmount;
    }

    enum Operation {
        Repay,
        Deposit,
        Borrow,
        Withraw
    }

    struct Action {
        uint amount;
        Operation operation;
    }

}
