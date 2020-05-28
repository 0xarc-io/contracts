pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;


library Types {

    // ============ Structs ============

    struct GlobalParams {
        uint256 collateralRatio;
        uint256 syntheticRatio;
        uint256 liquidationSpread;
        uint256 originationFee;
        address interestSetter;
        address stableAsset;
    }

    struct State {
        uint256 supplyTotal;
        uint256 supplyCompounded;
        uint256 borrowTotal;
        uint256 borrowCompounded;
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
