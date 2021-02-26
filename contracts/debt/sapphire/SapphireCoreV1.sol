// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireCore {

    function open(
        uint256 collateralAmount,
        uint256 borrowAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function borrow(
        uint256 positionId,
        uint256 collateralAmount,
        uint256 borrowAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function repay(
        uint256 positionId,
        uint256 repayAmount,
        uint256 withdrawAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function liquidate(
        uint256 positionId,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

}
