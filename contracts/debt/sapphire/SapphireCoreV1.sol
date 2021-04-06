// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;
import {SafeMath} from "../../lib/SafeMath.sol";

import {Decimal} from "../../lib/Decimal.sol";

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireCoreV1 {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Types ========== */

    struct OperationParams {
        address owner;
        uint256 amountOne;
        uint256 amountTwo;
        SapphireTypes.ScoreProof _scoreProof;
    }

    /* ========== Events ========== */

    event ActionOperated(
        uint8 _operation,
        OperationParams _params,
        SapphireTypes.Vault _updatedVault
    );

    event LiquidationFeesUpdated(
        Decimal.D256 _liquidationUserFee,
        Decimal.D256 _liquidationArcFee
    );

    event LimitsUpdated(
        uint256 _totalBorrowLimit,
        uint256 _valutCollateralMinimum,
        uint256 _vaultBorrowMaximum
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

    event AssessorUpdated(address _newAssessor);

    event CollateralRatiosUpdated(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    );

    event FeeCollectorUpdated(
        address _feeCollector
    );

    event TokensWithdrawn(
        address _token,
        address _destination,
        uint256 _amount
    );

    /* ========== Admin Setters ========== */

    function setInterestRate(
        uint256 _rate
    )
        public
    {}

    function setOracle(
        address _newOracle
    )
        public
    {}

    function setCollateralRatios(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    )
        public
    {}

    function setFees(
        uint256 _liquidationUserFee,
        uint256 _liquidationArcRatio
    )
        public
    {}

    function setLimits(
        uint256 _totalBorrowLimit,
        uint256 _vaultBorrowMinimum,
        uint256 _vaultBorrowMaximum
    )
        public
    {}

    function setInterestSetter(
        address _newInterestSetter
    )
        public
    {}

    function setcollateralRatioAssessor(
        address _newAssessor
    )
        public
    {}

    function setFeeCollector(
        address _newFeeCollector
    )
        public
    {}

    function setPause(
        bool _value
    )
        public
    {}

    /* ========== Public Functions ========== */

    function executeActions(
        SapphireTypes.Action[] memory actions,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function borrow(
        uint256 amount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }


    function repay(
        uint256 amount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function deposit(
        uint256 amount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function withdraw(
        uint256 amount,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    function liquidate(
        address owner,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
    {

    }

    /* ========== Public Getters ========== */

    function getVault(
        address owner
    )
        external
        view
        returns (SapphireTypes.Vault memory)
    {

    }

    /* ========== Private Functions ========== */

    function _borrow(
        uint256 amount
    )
        private
    {

    }


    function _repay(
        uint256 amount
    )
        private
    {

    }

    function _deposit(
        uint256 amount
    )
        private
    {

    }

    function _withdraw(
        uint256 amount
    )
        private
    {

    }

    function _liqiuidate(
        address owner
    )
        private
    {

    }
}
