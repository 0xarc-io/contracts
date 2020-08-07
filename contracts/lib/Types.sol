// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";
import {IOracle} from "../interfaces/IOracle.sol";

import {Math} from "./Math.sol";
import {Decimal} from "./Decimal.sol";
import {SignedMath} from "./SignedMath.sol";

library Types {

    using Math for uint256;
    using SafeMath for uint256;

    // ============ Enums ============

    enum AssetType {
        Collateral,
        Synthetic
    }

    // ============ Structs ============

    struct GlobalParams {
        IERC20 collateralAsset;
        ISyntheticToken syntheticAsset;
        Decimal.D256 collateralRatio;
        Decimal.D256 syntheticRatio;
        Decimal.D256 liquidationSpread;
        Decimal.D256 originationFee;
        IOracle oracle;
    }

    struct Position {
        address owner;
        AssetType collateralAsset;
        AssetType borrowedAsset;
        SignedMath.Int collateralAmount;
        SignedMath.Int borrowedAmount;
    }

    struct RiskParams {
        uint256 collateralLimit;
        uint256 syntheticLimit;
        uint256 positionCollateralMinimum;
        uint256 positionCollateralMaximum;
    }

    // ============ ArcAsset ============

    function oppositeAsset(
        AssetType assetType
    )
        internal
        pure
        returns (AssetType)
    {
        return assetType == AssetType.Collateral ? AssetType.Synthetic : AssetType.Collateral;
    }

}
