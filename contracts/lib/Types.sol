pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "./Decimal.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IInterestRate} from "../interfaces/IInterestRate.sol";

library Types {

    // ============ Structs ============

    struct GlobalParams {
        address stableAsset;
        IInterestRate interestRateModel;
        Decimal.D256 collateralRatio;
        Decimal.D256 syntheticRatio;
        Decimal.D256 liquidationSpread;
        Decimal.D256 originationFee;
        Decimal.D256 maximumUtilisationRatio;
        IOracle oracle;
    }

    struct State {
        uint256 supplyTotal;
        uint256 borrowTotal;
        Decimal.D256 index;
        uint256 lastIndexUpdate;
    }

    struct Position {
        address collateralAsset;
        uint256 collateralAmount;
        address borrowedAsset;
        uint256 borrowedAmount;
        Decimal.D256 lastIndex;
    }

    struct Balance {
        uint256 balance;
        Decimal.D256 lastIndex;
    }

}
