pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";

interface IInterestRate {

    function calculateRate(
        Decimal.D256 calldata utilisationRatio,
        uint256 lastIndexUpdate
    )
        external
        returns (Decimal.D256 memory);

}