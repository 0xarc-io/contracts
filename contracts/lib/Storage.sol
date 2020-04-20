pragma solidity ^0.6.6;

import "../token/ISyntheticToken.sol";


library Storage {
    struct GlobalParams {
        uint256 collateralRatio;
        uint256 syntheticRatio;
        uint256 liquidationSpread;
        uint256 originationFee;
    }

    struct Market {
        uint256 supply;
        uint256 borrow;
        address interestSetter;
    }

    struct State {
        mapping(uint256 => Position) positions;
        GlobalParams globalParams;
    }

    struct Synthetic {
        ISyntheticToken tokenAddress;
        address priceOracle;
    }

    struct Position {
        address collateralAsset;
        uint256 collateralAmount;
        address borrowedAsset;
        uint256 borrowedAmount;
    }
}
