// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {BaseERC20} from "../../token/BaseERC20.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {IOracle} from "../../oracle/IOracle.sol";

import {SapphireTypes} from "./SapphireTypes.sol";
import {SapphireCoreStorage} from "./SapphireCoreStorage.sol";

import "hardhat/console.sol";

contract SapphireCoreV1 is SapphireCoreStorage, Adminable {

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
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    );

    event LimitsUpdated(
        uint256 _totalBorrowLimit,
        uint256 _valutBorrowMinimum,
        uint256 _vaultBorrowMaximum
    );

    event IndexUpdated(
        uint256 _newIndex,
        uint256 _lastUpdateTime
    );

    event RateUpdated(uint256 _value);

    event OracleUpdated(address _oracle);

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

    /**
     * @dev Initialize the protocol with the appropriate parameters. Can only be called once.
     *
     * @param _collateralAddress    The address of the collateral to be used
     * @param _syntheticAddress     The address of the synthetic token proxy
     * @param _oracleAddress        The address of the IOracle conforming contract
     * @param _interestSetter       The address which can update interest rates
     * @param _assessor,            The address of assessor contract, which provides credit score functionality
     * @param _feeCollector         The address of the ARC fee collector when a liquidation occurs
     * @param _highCollateralRatio  High limit of how much collateral is needed to borrow
     * @param _lowCollateralRatio   Low limit of how much collateral is needed to borrow
     * @param _liquidationUserFee   How much is a user penalized if they go below their c-ratio
     * @param _liquidationArcFee    How much of the liquidation profit should ARC take
     */
    function init(
        address _collateralAddress,
        address _syntheticAddress,
        address _oracleAddress,
        address _interestSetter,
        address _assessor,
        address _feeCollector,
        uint256 _highCollateralRatio,
        uint256 _lowCollateralRatio,
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    )
        public
        onlyAdmin
    {
        require(
            collateralAsset == address(0),
            "SapphireCoreV1: cannot re-initialize contract"
        );

        require(
            _collateralAddress != address(0),
            "SapphireCoreV1: collateral is required"
        );

        require(
            _syntheticAddress != address(0),
            "SapphireCoreV1: synthetic is required"
        );

        paused = true;
        borrowIndex = BASE;
        indexLastUpdate = getCurrentTimestamp();
        collateralAsset = _collateralAddress;
        syntheticAsset = _syntheticAddress;
        interestSetter = _interestSetter;
        feeCollector = _feeCollector;

        BaseERC20 collateral = BaseERC20(collateralAsset);
        precisionScalar = 10 ** (18 - uint256(collateral.decimals()));

        setCollateralRatioAssessor(_assessor);
        setOracle(_oracleAddress);
        setCollateralRatios(_lowCollateralRatio, _highCollateralRatio);
        setFees(_liquidationUserFee, _liquidationArcFee);
    }

    function setOracle(
        address _oracle
    )
        public
        onlyAdmin
    {
        oracle = IOracle(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setCollateralRatios(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    )
        public
        onlyAdmin
    {
        require(
            _lowCollateralRatio >= BASE &&  _highCollateralRatio >= BASE,
            "SapphireCoreV1: collateral ratio has to be at least 1"
        );

        require(
            _lowCollateralRatio <=  _highCollateralRatio,
            "SapphireCoreV1: high c-ratio is lower than the low c-ratio"
        );

        lowCollateralRatio = _lowCollateralRatio;
        highCollateralRatio = _highCollateralRatio;

        emit CollateralRatiosUpdated(lowCollateralRatio, highCollateralRatio);
    }

    function setFees(
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    )
        public
        onlyAdmin
    {
        require(
            _liquidationUserFee.add(_liquidationArcFee) <= BASE,
            "SapphireCoreV1: fee sum has to be no more than 100%"
        );

        liquidationUserFee = _liquidationUserFee;
        liquidationArcFee = _liquidationArcFee;
        emit LiquidationFeesUpdated(liquidationUserFee, liquidationArcFee);
    }

    function setLimits(
        uint256 _totalBorrowLimit,
        uint256 _vaultBorrowMinimum,
        uint256 _vaultBorrowMaximum
    )
        public
        onlyAdmin
    {
        require(
            _vaultBorrowMinimum <= _vaultBorrowMaximum,
            "SapphireCoreV1: required condition is vaultMin <= vaultMax <= totalLimit"
        );

        require(
            _vaultBorrowMaximum <= _totalBorrowLimit,
            "SapphireCoreV1: required condition is vaultMin <= vaultMax <= totalLimit"
        );

        vaultBorrowMinimum = _vaultBorrowMinimum;
        vaultBorrowMaximum = _vaultBorrowMaximum;
        totalBorrowLimit = _totalBorrowLimit;

        emit LimitsUpdated(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum);
    }

    function setInterestSetter(
        address _interestSetter
    )
        public
        onlyAdmin
    {
        interestSetter = _interestSetter;
        emit InterestSetterUpdated(interestSetter);
    }

    function setCollateralRatioAssessor(
        address _assessor
    )
        public
        onlyAdmin
    {
        collateralRatioAssessor= _assessor;
        emit AssessorUpdated(collateralRatioAssessor);
    }

    function setFeeCollector(
        address _newFeeCollector
    )
        public
        onlyAdmin
    {
        feeCollector = _newFeeCollector;
        emit FeeCollectorUpdated(feeCollector);
    }

    function setPause(
        bool _value
    )
        public
        onlyAdmin
    {
        paused = _value;
        emit PauseStatusUpdated(paused);
    }

    /**
     * @dev Update the interest rate of the protocol. Since this rate is compounded
     *      every second rather than being purely linear, the calculate for r is expressed
     *      as the following (assuming you want 5% APY):
     *
     *      r^N = 1.05
     *      since N = 365 * 24 * 60 * 60 (number of seconds in a year)
     *      r = 1.000000001547125957863212...
     *      rate = 1000000001547125957 (18 decimal places solidity value)
     *
     * @notice Can only be called by the interest setter of the protocol and the maximum
     *         rate settable by the admin is 99% (21820606489)
     *
     * @param _interestRate The interest rate expressed per second
     */
    function setInterestRate(
        uint256 _interestRate
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

    function updateIndex()
        public
        returns (uint256)
    {

    }

    /* ========== Public Getters ========== */

    /**
     * @dev Returns current block's timestamp
     *
     * @notice This function is introduced in order to properly test time delays in this contract
     */
    function getCurrentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    function getVault(
        address owner
    )
        external
        view
        returns (SapphireTypes.Vault memory)
    {

    }

    function accumulatedInterest()
        public
        view
        returns (uint256)
    {

    }

    function currentBorrowIndex()
        public
        view
        returns (uint256)
    {
        
    }

    /* ========== Developer Functions ========== */

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
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
