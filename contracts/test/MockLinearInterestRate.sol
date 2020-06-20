pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {LinearInterestRate} from "../impl/LinearInterestRate.sol";
import {Decimal} from "../lib/Decimal.sol";

contract MockLinearInterestRateModel is LinearInterestRate {

    uint256 public CURRENT_TIMESTAMP;

    constructor(
        Decimal.D256 memory _startingRate,
        Decimal.D256 memory _gradient,
        Decimal.D256 memory _maximumRate
    )
        LinearInterestRate(_startingRate, _gradient, _maximumRate)
        public
    { }

    function setTimestamp(uint256 value) public {
        CURRENT_TIMESTAMP = value;
    }

    function currentTimestamp()
        internal
        virtual
        override
        view
        returns (uint256)
    {
        return CURRENT_TIMESTAMP;
    }

}