// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {ID2Core} from "../interfaces/ID2Core.sol";
import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IERC20} from "../interfaces/IERC20.sol";

import {Amount} from "../lib/Amount.sol";
import {Decimal} from "../lib/Decimal.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {Ownable} from "../lib/Ownable.sol";

contract D2SavingsV1 is Ownable {

    /* ========== Libraries ========== */

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Amount for Amount.Principal;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Variables ========== */

    ID2Core public core;
    address public synthetic;

    bool    public fullyCollateralized;
    bool    public paused;

    uint256 public savingsIndex;
    uint256 public savingsRate;

    uint256 public indexLastUpdate;
    uint256 public totalSupplied;
    uint256 public totalIssued;

    address      public arcFeeDestination;
    Decimal.D256 public arcFee;

    mapping (address => Amount.Principal) internal _balances;

    /* ========== Modifier ========== */

    modifier isActive() {
        require(
            paused == false,
            "D2Savings: contract is paused"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor(
        address _coreAddress,
        address _syntheticAddress,
        address _feeDestination,
        Decimal.D256 memory _fee
    )
        public
    {
        synthetic = _syntheticAddress;
        core = ID2Core(_coreAddress);
        fullyCollateralized = true;

        setArcFee(_feeDestination, _fee);
    }

    /* ========== Public View Functions ========== */

    function exchangeRate()
        public
        view
        returns (uint256)
    {
        return savingsIndex;
    }

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    function getSavingsRate()
        public
        view
        returns (uint256)
    {
        return savingsRate;
    }

    function balanceOf(
        address user
    )
        public
        view
        returns (uint256)
    {
        return _balances[user].value;
    }

    /* ========== Admin Functions ========== */

    function setSavingsRate(
        uint256 rate
    )
        public
        onlyOwner
    {
        savingsRate = rate;
    }

    function setArcFee(
        address _feeDestination,
        Decimal.D256 memory _fee
    )
        public
        onlyOwner
    {
        arcFeeDestination = _feeDestination;
        arcFee = _fee;
    }

    function setFullyCollateralized(
        bool value
    )
        public
        onlyOwner
    {
        fullyCollateralized = value;
    }

    function setPaused(
        bool status
    )
        public
        onlyOwner
    {
        paused = status;
    }

    /* ========== Public Functions ========== */

    function stake(
        uint256 amount
    )
        public
        isActive
    {
        // Update the index first
        updateIndex();

        // Calculate your stake amount given the current index
        Amount.Principal memory stakeAmount = Amount.calculatePrincipal(
            amount,
            savingsIndex,
            true
        );

        // Set your balance to the stake amount based on the adjusted-amount
        _balances[msg.sender] = _balances[msg.sender].add(stakeAmount);

        // Transfer the synth
        IERC20(synthetic).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Increase the totalSupplied amount
        totalSupplied = totalSupplied.add(amount);
    }

    function unstake(
        uint256 amount
    )
        public
        isActive
    {
        // Update the index first
        updateIndex();

        // Calculate the withdraw amount given the index
        Amount.Principal memory withdrawAmount = Amount.calculatePrincipal(
            amount,
            savingsIndex,
            true
        );

        // Set the new reduced balance
        _balances[msg.sender] = _balances[msg.sender].sub(withdrawAmount);

        // Transfer the synth
        IERC20(synthetic).transfer(
            msg.sender,
            amount
        );

        // Decrease the totalSupplied amount
        totalSupplied = totalSupplied.sub(amount);
    }

    function updateIndex()
        public
        isActive
    {
        // Check if the index is zero, then only the owner can call it
        if (savingsIndex == 0) {
            require (
                msg.sender == owner(),
                "updateIndex(): first call can only be made by owner"
            );

            savingsIndex = BASE;
        }

        if (
            currentTimestamp() == indexLastUpdate ||
            savingsRate == 0
        ) {
            return;
        }

        // Check the time since the last update, multiply to get interest generated
        uint256 interestAccumulated = savingsRate.mul(currentTimestamp().sub(indexLastUpdate));

        // Set the new index based on how much accrued
        savingsIndex = savingsIndex.add(interestAccumulated);

        uint256 existingSupply = totalSupplied;
        totalSupplied = totalSupplied.mul(savingsIndex).div(BASE);

        // With the difference between the new amount being borrowed and the existing amount
        // we can figure out how much interest is owed to the system as a whole and therefore
        // calculate how much of the synth to mint
        uint256 interestAccrued = totalSupplied.sub(existingSupply);

        // The amount of interest ARC accrues
        uint256 arcInterest = Decimal.mul(
            interestAccrued,
            arcFee
        );

        ISyntheticToken synth = ISyntheticToken(synthetic);

        // Increase the total issued amount from this contract
        totalIssued = totalIssued.add(interestAccrued);

        synth.mint(
            address(this),
            interestAccrued.sub(arcInterest)
        );

        synth.mint(
            arcFeeDestination,
            arcInterest
        );

        // Set the last time the index was updated to now
        indexLastUpdate = currentTimestamp();

        // A hard check to enable the system doesn't go into deficit
        if (fullyCollateralized) {
            (,
                uint256 coreTotalBorrowed,
                Amount.Principal memory coreTotalIssued
            ) = core.getTotals();

            // This is only possible if the amount burned < minted
            // Possible if everyone is trying to exit the core system
            if (coreTotalIssued.sign == false) {
                return;
            }

            // The coreTotalBorrowed is how much is collectively owed. AKA Healthy Debt.
            // If the amount of synths issued by core + this contract exceed the above
            // there's probably been too much debt minted in the system. We may want to
            // do this intentionally and repay it via other means too.
            require(
                coreTotalBorrowed >= coreTotalIssued.value.add(totalIssued),
                "The total amount of synths in the system should not exceed borrows"
            );

        }
    }
}
