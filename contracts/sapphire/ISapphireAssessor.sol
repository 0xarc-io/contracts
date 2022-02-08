// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphireTypes} from "./SapphireTypes.sol";

interface ISapphireAssessor {
    function assess(
        uint256 _lowerBound,
        uint256 _upperBound,
        SapphireTypes.ScoreProof calldata _scoreProof,
        bool _isScoreRequired
    )
        external
        returns (uint256);

    function assessCreditLimit(
        uint256 _borrowAmount,
        SapphireTypes.ScoreProof calldata _scoreProof
    )
        external
        returns (bool);
}
