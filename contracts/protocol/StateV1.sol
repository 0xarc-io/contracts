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

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Math} from "../lib/Math.sol";
import {Time} from "../lib/Time.sol";
import {SignedMath} from "../lib/SignedMath.sol";

contract StateV1 {

    using Math for uint256;
    using SafeMath for uint256;
    using Types for Types.Par;

    // ============ Variables ============

    address core;
    address admin;

    Types.MarketParams public market;
    Types.RiskParams public risk;

    IOracle public oracle;
    address public collateralAsset;
    address public syntheticAsset;

    uint256 public positionCount;
    uint256 public totalSupplied;

    mapping (uint256 => Types.Position) public positions;

    // ============ Events ============

    event MarketParamsUpdated(Types.MarketParams updatedMarket);
    event RiskParamsUpdated(Types.RiskParams updatedParams);

    // ============ Constructor ============

    constructor(
        address _core,
        address _admin,
        address _collateralAsset,
        address _syntheticAsset,
        address _oracle,
        Types.MarketParams memory _marketParams,
        Types.RiskParams memory _riskParams
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
        Types.MarketParams memory _marketParams
    )
        public
        onlyAdmin
    {
        market = _marketParams;
        emit MarketParamsUpdated(market);
    }

    function setRiskParams(
        Types.RiskParams memory _riskParams
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
        Types.Position memory position
    )
        public
        onlyCore
        returns (uint256 id)
    {
        id = positionCount;
        positions[positionCount] = position;
        positionCount++;
    }

    function setAmount(
        uint256 id,
        Types.AssetType asset,
        Types.Par memory amount
    )
        public
        onlyCore
        returns (Types.Position memory)
    {
        Types.Position storage position = positions[id];

        if (position.collateralAsset == asset) {
            position.collateralAmount = amount;
        } else {
            position.borrowedAmount = amount;
        }

        return position;
    }

    function updatePositionAmount(
        uint256 id,
        Types.AssetType asset,
        Types.Par memory amount
    )
        public
        onlyCore
        returns (Types.Position memory)
    {
        Types.Position storage position = positions[id];

        if (position.collateralAsset == asset) {
            position.collateralAmount = position.collateralAmount.add(amount);
        } else {
            position.borrowedAmount = position.borrowedAmount.add(amount);
        }

        return position;
    }

    // ============ Public Getters ============

    function getAddress(
        Types.AssetType asset
    )
        public
        view
        returns (address)
    {
        return asset == Types.AssetType.Collateral ?
            address(collateralAsset) :
            address(syntheticAsset);
    }

    function getPosition(
        uint256 id
    )
        public
        view
        returns (Types.Position memory)
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
        Types.Position memory position
    )
        public
        view
        returns (bool)
    {
        if (position.borrowedAmount.value == 0) {
            return true;
        }

        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        (Types.Par memory collateralDelta) = calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            currentPrice
        );

        return collateralDelta.sign || collateralDelta.value == 0;
    }

    function calculateInverseAmount(
        Types.AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        public
        pure
        returns (uint256)
    {
        uint256 borrowRequired;

        if (asset == Types.AssetType.Collateral) {
            borrowRequired = Decimal.mul(
                amount,
                price
            );
        } else if (asset == Types.AssetType.Synthetic) {
            borrowRequired = Decimal.div(
                amount,
                price
            );
        }

        return borrowRequired;
    }

    function calculateInverseRequired(
        Types.AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        public
        view
        returns (Types.Par memory)
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

        if (asset == Types.AssetType.Collateral) {
            inverseRequired = Decimal.div(
                inverseRequired,
                market.collateralRatio
            );

        } else if (asset == Types.AssetType.Synthetic) {
            inverseRequired = Decimal.mul(
                inverseRequired,
                market.collateralRatio
            );
        }

        console.log("   inverse required: %s", inverseRequired);

        return Types.Par({
            sign: true,
            value: inverseRequired.to128()
        });
    }

    function calculateLiquidationPrice(
        Types.AssetType asset
    )
        public
        view
        returns (Decimal.D256 memory price)
    {
        console.log("*** calculateLiquidationPrice ***");

        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        console.log("   current price: %s", currentPrice.value);

        uint256 totalSpread = market.liquidationUserFee.value.add(
            market.liquidationArcFee.value
        );

        console.log("   total spread: %s", totalSpread);

        if (asset == Types.AssetType.Collateral) {
            result = Decimal.sub(
                Decimal.one(),
                totalSpread
            );
        } else if (asset == Types.AssetType.Synthetic) {
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
        Types.AssetType borrowedAsset,
        Types.Par memory parSupply,
        Types.Par memory parBorrow,
        Decimal.D256 memory price
    )
        public
        view
        returns (Types.Par memory)
    {
        console.log("*** calculateCollateralDelta ***");

        Types.Par memory collateralDelta;
        Types.Par memory collateralRequired;

        console.log("   original borrow: %s", parBorrow.value);

        console.log("   wei borrow: %s", parBorrow.value);

        if (borrowedAsset == Types.AssetType.Collateral) {
            collateralRequired = calculateInverseRequired(
                borrowedAsset,
                parBorrow.value,
                price
            );
        } else if (borrowedAsset == Types.AssetType.Synthetic) {
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

    function calculateLiquidationSplit()
        public
        view
        returns (
            Decimal.D256 memory userRatio,
            Decimal.D256 memory arcRatio
        )
    {
        Decimal.D256 memory total = Decimal.D256({
            value: market.liquidationUserFee.value.add(
                market.liquidationArcFee.value
            )
        });

        userRatio = Decimal.D256({
            value: Decimal.div(
                market.liquidationUserFee.value,
                total
            )
        });

        arcRatio = Decimal.sub(
            Decimal.one(),
            userRatio.value
        );
    }

}