pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {IInterestRate} from "../interfaces/IInterestRate.sol";
import {Decimal} from "../lib/Decimal.sol";

contract LinearInterestRate is IInterestRate {

    using SafeMath for uint256;

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
        startingRate = _startingRate;
        gradient = _gradient;
        maximumRate = _maximumRate;
    }

    function calculateRate(
        Decimal.D256 memory utilisationRatio
    )
        public
        view
        override
        returns (Decimal.D256 memory)
    {
        if (utilisationRatio.value == 0) {
            return Decimal.D256({ value: 0 });
        }

        uint256 baseRate = gradient.value.mul(utilisationRatio.value).div(Decimal.BASE).add(startingRate.value);
        return Decimal.D256({ value: baseRate });
    }

    function calculateIndex(
        Decimal.D256 memory utilisationRatio,
        uint256 lastIndexUpdate
    )
        public
        view
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
        if (utilisationRatio.value == 0) {
            return Decimal.one();
        }

        uint256 timeDelta = currentTimestamp().sub(lastIndexUpdate);
        uint256 baseRate = calculateRate(utilisationRatio).value;
        uint256 finalRate = baseRate.mul(timeDelta).div(SECONDS_IN_A_YEAR);

        return Decimal.D256({ value: finalRate });
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