// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {BaseERC20} from "../../token/BaseERC20.sol";
import {IERC20} from "../../token/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {IOracle} from "../../oracle/IOracle.sol";

import {SapphireTypes} from "./SapphireTypes.sol";
import {SapphireCoreStorage} from "./SapphireCoreStorage.sol";
import {SapphireAssessor} from "./SapphireAssessor.sol";

import "hardhat/console.sol";

contract SapphireCoreV1 is SapphireCoreStorage, Adminable {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Events ========== */

    event ActionsOperated(
        SapphireTypes.Action[] _actions,
        SapphireTypes.ScoreProof _scoreProof,
        address _user
    );

    event LiquidationFeesUpdated(
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    );

    event LimitsUpdated(
        uint256 _collateralLimit,
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
        uint256 _totalCollateralLimit,
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

        collateralLimit = _totalCollateralLimit;
        vaultBorrowMinimum = _vaultBorrowMinimum;
        vaultBorrowMaximum = _vaultBorrowMaximum;
        totalBorrowLimit = _totalBorrowLimit;

        emit LimitsUpdated(collateralLimit, totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum);
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

    /**
     * @dev Deposits the given `_amount` of collateral to the `msg.sender`'s vault.
     *
     * @param _amount The amount of collateral to deposit
     * @param _scoreProof The credit score proof - optional
     */
    function deposit(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            _amount,
            SapphireTypes.Operation.Deposit
        );

        executeActions(actions, _scoreProof);
    }

    function withdraw(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {

    }

    function borrow(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {

    }

    function repay(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {

    }

    function liquidate(
        address _owner,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {

    }

    /**
     * @dev All other user-called functions use this function to execute the 
     *      passed actions. This function first updates the indeces before
     *      actually executing the actions.
     *
     * @param _actions      An array of actions to execute
     * @param _scoreProof   The credit score proof of the user that calles this
     *                      function
     */
    function executeActions(
        SapphireTypes.Action[] memory _actions,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        require(
            paused == false,
            "SapphireCoreV1: the contract is paused"
        );

        SapphireAssessor assessor = SapphireAssessor(collateralRatioAssessor);

        // Update the index to calculate how much interest has accrued
        updateIndex();

        for (uint256 i = 0; i < _actions.length; i++) {
            SapphireTypes.Action memory action = _actions[i];

            if (action.operation == SapphireTypes.Operation.Deposit) {
                // Update the user's credit score
                assessor.assess(
                    lowCollateralRatio,
                    highCollateralRatio,
                    _scoreProof,
                    false
                );
                
                // Deposit collateral
                _deposit(action.amount);
            }
        }

        console.log(
            "actions length: %s",
            _actions.length
        );

        emit ActionsOperated(
            _actions,
            _scoreProof,
            msg.sender
        );
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
        public
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

    /**
     * @dev Deposits the collateral amount in the user's vault, then ensures
     *      the deposit amount is not greater than the collateral limit
     */
    function _deposit(
        uint256 _amount
    )
        private
    {   
        // Record deposit
        SapphireTypes.Vault storage vault = vaults[msg.sender];

        if (_amount == 0) {
            return;
        }

        vault.collateralAmount = vault.collateralAmount.add(_amount);

        totalCollateral = totalCollateral.add(_amount);

        // Execute transfer
        IERC20 collateralAsset = IERC20(collateralAsset);
        SafeERC20.safeTransferFrom(
            collateralAsset,
            msg.sender,
            address(this),
            _amount
        );

        // Ensure the total collateral <= collateral limit
        require (
            totalCollateral <= collateralLimit,
            "SapphireCoreV1: collateral limit reached"
        );
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
