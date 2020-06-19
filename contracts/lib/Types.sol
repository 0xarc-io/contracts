pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "./Decimal.sol";
import {IOracle} from "../interfaces/IOracle.sol";

library Types {

    // ============ Structs ============

    struct GlobalParams {
        address interestSetter;
        address stableAsset;
        Decimal.D256 collateralRatio;
        Decimal.D256 syntheticRatio;
        Decimal.D256 liquidationSpread;
        Decimal.D256 originationFee;
        Decimal.D256 maximumUtilisationRatio;
        IOracle oracle;
    }

    struct State {
        uint256 supplyTotal;
        Decimal.D256 supplyCompounded;
        uint256 borrowTotal;
        Decimal.D256 borrowCompounded;
        Decimal.D256 supplyIndex;
        Decimal.D256 borrowIndex;
        uint256 lastIndexUpdate;
    }

    struct Position {
        address collateralAsset;
        uint256 collateralAmount;
        address borrowedAsset;
        uint256 borrowedAmount;
    }

    struct Exchange {
        uint256 liquiditySupplied;
    }
}
