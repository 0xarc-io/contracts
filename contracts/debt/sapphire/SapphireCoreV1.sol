// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;
import {SafeMath} from "../../lib/SafeMath.sol";

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireCore {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Types ========== */

    enum Operation {
        Open,
        Borrow,
        Repay,
        Liquidate,
        TransferOwnership
    }

    /* ========== Events ========== */

    /* ========== Public Functions ========== */

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

    /* ========== Public Getters ========== */

    function getPosition(
        uint256 id
    )
        external
        view
        returns (SapphireTypes.Position memory)
    {
    }

}
