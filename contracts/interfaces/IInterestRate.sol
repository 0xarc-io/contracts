pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";

interface IInterestRate {

    function calculateIndex(
        Decimal.D256 calldata utilisationRatio,
        uint256 lastIndexUpdate
    )
        external
        view
        returns (Decimal.D256 memory);

    function calculateRate(
        Decimal.D256 calldata utilisationRatio
    )
        external
        view
        returns (Decimal.D256 memory);
}