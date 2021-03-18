// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;
import {SafeMath} from "../../lib/SafeMath.sol";

import {Decimal} from "../../lib/Decimal.sol";

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

    event PositionOpened(
        uint256 _collateralAmount,
        uint256 _borrowAmount,
        SapphireTypes.ScoreProof _scoreProof
    );

    event Borrowed(
        uint256 _positionId,
        uint256 _collateralAmount,
        uint256 _borrowAmount,
        SapphireTypes.ScoreProof _scoreProof
    );

    event Repayed(
        uint256 _positionId,
        uint256 _repayAmount,
        uint256 withdrawAmount,
        SapphireTypes.ScoreProof _scoreProof
    );

    event Liquidated(
        address _liquidator,
        SapphireTypes.Position _updatedPosition,
        SapphireTypes.ScoreProof _scoreProof
    );

    event OwnershipTransfered(
        uint256 _positionId,
        address _newOwner
    );

    event LiquidationFeesUpdated(
        Decimal.D256 _liquidationUserFee,
        Decimal.D256 _liquidationArcRatio
    );

    event LimitsUpdated(
        uint256 _collateralLimit,
        uint256 _collateralMinimum
    );

    event GlobalOperatorSet(
        address _operator,
        bool _status
    );

    event PositionOperatorSet(
        uint256 _positionId,
        address _operator,
        bool _status
    );

    event IndexUpdated(
        uint256 _newIndex,
        uint256 _lastUpdateTime
    );

    event RateUpdated(uint256 _value);

    event OracleUpdated(address _oracle);

    event CollateralRatioUpdated(Decimal.D256 _collateralRatio);

    event PauseStatusUpdated(bool _pauseStatus);

    event InterestSetterUpdated(address _newInterestSetter);

    event TokensWithdrawn(
        address _token,
        address _destination,
        uint256 _amount
    );

    event StrategyUpdated(address _newStrategy);

    /* ========== Public Functions ========== */

    function open(
        uint256 collateralAmount,
        uint256 borrowAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public;

    function borrow(
        uint256 positionId,
        uint256 collateralAmount,
        uint256 borrowAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public;

    function repay(
        uint256 positionId,
        uint256 repayAmount,
        uint256 withdrawAmount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public;

    function liquidate(
        uint256 positionId,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public;

}
