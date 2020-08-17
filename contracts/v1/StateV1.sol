// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {IOracle} from "../interfaces/IOracle.sol";
import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";

import {TypesV1} from "./TypesV1.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Math} from "../lib/Math.sol";
import {SignedMath} from "../lib/SignedMath.sol";

contract StateV1 {

    using Math for uint256;
    using SafeMath for uint256;
    using TypesV1 for TypesV1.Par;

    // ============ Variables ============

    address core;
    address admin;

    TypesV1.MarketParams public market;
    TypesV1.RiskParams public risk;

    IOracle public oracle;
    address public collateralAsset;
    address public syntheticAsset;

    uint256 public positionCount;
    uint256 public totalSupplied;

    mapping (uint256 => TypesV1.Position) public positions;

    // ============ Events ============

    event MarketParamsUpdated(TypesV1.MarketParams updatedMarket);
    event RiskParamsUpdated(TypesV1.RiskParams updatedParams);

    // ============ Constructor ============

    constructor(
        address _core,
        address _admin,
        address _collateralAsset,
        address _syntheticAsset,
        address _oracle,
        TypesV1.MarketParams memory _marketParams,
        TypesV1.RiskParams memory _riskParams
    )
        public
    {
        core = _core;
        admin = _admin;
        collateralAsset = _collateralAsset;
        syntheticAsset = _syntheticAsset;

        setOracle(_oracle);
        setMarketParams(_marketParams);
        setRiskParams(_riskParams);
    }

    // ============ Modifiers ============

    modifier onlyCore() {
        require(
            msg.sender == core,
            "State: only core can call"
        );
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == admin,
            "State: only core can call"
        );
        _;
    }

    // ============ Admin Setters ============

    function setOracle(
        address _oracle
    )
        public
        onlyAdmin
    {
        oracle = IOracle(_oracle);
        emit MarketParamsUpdated(market);
    }

    function setMarketParams(
        TypesV1.MarketParams memory _marketParams
    )
        public
        onlyAdmin
    {
        market = _marketParams;
        emit MarketParamsUpdated(market);
    }

    function setRiskParams(
        TypesV1.RiskParams memory _riskParams
    )
        public
        onlyAdmin
    {
        risk = _riskParams;
        emit RiskParamsUpdated(risk);
    }

    // ============ Core Setters ============

    function updateTotalSupplied(
        uint256 amount
    )
        public
        onlyCore
    {
        totalSupplied = totalSupplied.add(amount);
    }

    function savePosition(
        TypesV1.Position memory position
    )
        public
        onlyCore
        returns (uint256)
    {
        uint256 idToAllocate = positionCount;
        positions[positionCount] = position;
        positionCount++;

        return idToAllocate;
    }

    function setAmount(
        uint256 id,
        TypesV1.AssetType asset,
        TypesV1.Par memory amount
    )
        public
        onlyCore
        returns (TypesV1.Position memory)
    {
        TypesV1.Position storage position = positions[id];

        if (position.collateralAsset == asset) {
            position.collateralAmount = amount;
        } else {
            position.borrowedAmount = amount;
        }

        return position;
    }

    function updatePositionAmount(
        uint256 id,
        TypesV1.AssetType asset,
        TypesV1.Par memory amount
    )
        public
        onlyCore
        returns (TypesV1.Position memory)
    {
        TypesV1.Position storage position = positions[id];

        if (position.collateralAsset == asset) {
            position.collateralAmount = position.collateralAmount.add(amount);
        } else {
            position.borrowedAmount = position.borrowedAmount.add(amount);
        }

        return position;
    }

    // ============ Public Getters ============

    function getAddress(
        TypesV1.AssetType asset
    )
        public
        view
        returns (address)
    {
        return asset == TypesV1.AssetType.Collateral ?
            address(collateralAsset) :
            address(syntheticAsset);
    }

    function getPosition(
        uint256 id
    )
        public
        view
        returns (TypesV1.Position memory)
    {
        return positions[id];
    }

    function getCurrentPrice()
        public
        view
        returns (Decimal.D256 memory)
    {
        return oracle.fetchCurrentPrice();
    }

    // ============ Calculation Getters ============

    function isCollateralized(
        TypesV1.Position memory position
    )
        public
        view
        returns (bool)
    {
        if (position.borrowedAmount.value == 0) {
            return true;
        }

        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        (TypesV1.Par memory collateralDelta) = calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            currentPrice
        );

        return collateralDelta.sign || collateralDelta.value == 0;
    }

    function calculateInverseAmount(
        TypesV1.AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        public
        pure
        returns (uint256)
    {
        uint256 borrowRequired;

        if (asset == TypesV1.AssetType.Collateral) {
            borrowRequired = Decimal.mul(
                amount,
                price
            );
        } else if (asset == TypesV1.AssetType.Synthetic) {
            borrowRequired = Decimal.div(
                amount,
                price
            );
        }

        return borrowRequired;
    }

    function calculateInverseRequired(
        TypesV1.AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        public
        view
        returns (TypesV1.Par memory)
    {
        console.log("*** calculateInverseRequired ***");

        console.log("   amount: %s", amount);
        console.log("   price: %s", price.value);

        uint256 inverseRequired = calculateInverseAmount(
            asset,
            amount,
            price
        );

        console.log("   inverse amount: %s", inverseRequired);

        if (asset == TypesV1.AssetType.Collateral) {
            inverseRequired = Decimal.div(
                inverseRequired,
                market.collateralRatio
            );

        } else if (asset == TypesV1.AssetType.Synthetic) {
            inverseRequired = Decimal.mul(
                inverseRequired,
                market.collateralRatio
            );
        }

        console.log("   inverse required: %s", inverseRequired);

        return TypesV1.Par({
            sign: true,
            value: inverseRequired.to128()
        });
    }

    function calculateLiquidationPrice(
        TypesV1.AssetType asset
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        console.log("*** calculateLiquidationPrice ***");

        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        console.log("   current price: %s", currentPrice.value);

        uint256 totalSpread = market.liquidationUserFee.value.add(
            market.liquidationArcFee.value
        );

        console.log("   total spread: %s", totalSpread);

        if (asset == TypesV1.AssetType.Collateral) {
            result = Decimal.sub(
                Decimal.one(),
                totalSpread
            );
        } else if (asset == TypesV1.AssetType.Synthetic) {
            result = Decimal.add(
                Decimal.one(),
                totalSpread
            );
        }

        result = Decimal.mul(
            currentPrice,
            result
        );

        return result;
    }

    function calculateCollateralDelta(
        TypesV1.AssetType borrowedAsset,
        TypesV1.Par memory parSupply,
        TypesV1.Par memory parBorrow,
        Decimal.D256 memory price
    )
        public
        view
        returns (TypesV1.Par memory)
    {
        console.log("*** calculateCollateralDelta ***");

        TypesV1.Par memory collateralDelta;
        TypesV1.Par memory collateralRequired;

        console.log("   original borrow: %s", parBorrow.value);

        console.log("   wei borrow: %s", parBorrow.value);

        if (borrowedAsset == TypesV1.AssetType.Collateral) {
            collateralRequired = calculateInverseRequired(
                borrowedAsset,
                parBorrow.value,
                price
            );
        } else if (borrowedAsset == TypesV1.AssetType.Synthetic) {
            collateralRequired = calculateInverseRequired(
                borrowedAsset,
                parBorrow.value,
                price
            );
        }

        collateralDelta = parSupply.sub(collateralRequired);

        return collateralDelta;
    }

    function totalLiquidationSpread()
        public
        view
        returns (Decimal.D256 memory)
    {
        return Decimal.D256({
            value: market.liquidationUserFee.value.add(
                market.liquidationArcFee.value
            )
        });
    }

    /**
     * @dev Calculate the liquidation ratio between the user and ARC.
     *
     * @return First parameter it the user ratio, second is ARC's ratio
     */
    function calculateLiquidationSplit()
        public
        view
        returns (
            Decimal.D256 memory,
            Decimal.D256 memory
        )
    {
        Decimal.D256 memory total = Decimal.D256({
            value: market.liquidationUserFee.value.add(
                market.liquidationArcFee.value
            )
        });

        Decimal.D256 memory userRatio = Decimal.D256({
            value: Decimal.div(
                market.liquidationUserFee.value,
                total
            )
        });

        return (
            userRatio,
            Decimal.sub(
                Decimal.one(),
                userRatio.value
            )
        );
    }

}