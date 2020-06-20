pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {IInterestRate} from "../interfaces/IInterestRate.sol";
import {Decimal} from "../lib/Decimal.sol";

contract LinearInterestRate is IInterestRate {

    Decimal.D256 public startingRate;

    Decimal.D256 public gradient;

    Decimal.D256 public maximumRate;

    uint256 constant SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365;

    constructor(
        Decimal.D256 memory _startingRate,
        Decimal.D256 memory _gradient,
        Decimal.D256 memory _maximumRate
    )
        public
    {

    }

    function calculateRate(
        Decimal.D256 calldata utilisationRatio,
        uint256 lastIndexUpdate
    )
        external
        override
        returns (Decimal.D256 memory)
    {

        // Get difference in seconds since last index update
        // Divide difference by seconds in a year
        // Result = timeElapsed

        // Get starting rate + gradient * utilisationRatio
        // Result = rate

        // Multiply rate * timeElapsed
        // If gt than _maximumRate, return maximumRate

    }

    function currentTimestamp()
        internal
        virtual
        view
        returns (uint256)
    {
        return block.timestamp;
    }

}