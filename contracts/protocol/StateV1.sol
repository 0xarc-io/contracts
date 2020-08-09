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
    using SignedMath for SignedMath.Int;

    // ============ Variables ============

    address core;
    address admin;

    Types.GlobalParams public params;
    Types.RiskParams public risk;

    address public collateralAsset;
    address public syntheticAsset;
    IOracle public oracle;

    uint256 public positionCount;
    uint256 public totalSupplied;

    mapping (uint256 => Types.Position) public positions;

    // ============ Events ============

    event GlobalParamsUpdated(Types.GlobalParams updatedParams);
    event RiskParamsUpdated(Types.RiskParams updatedParams);

    // ============ Constructor ============

    constructor(
        address _core,
        address _admin,
        address _collateralAsset,
        address _syntheticAsset,
        address _oracle,
        Types.GlobalParams memory _globalParams,
        Types.RiskParams memory _riskParams
    )
        public
    {
        core = _core;
        admin = _admin;
        collateralAsset = _collateralAsset;
        syntheticAsset = _syntheticAsset;

        oracle = IOracle(_oracle);
        params = _globalParams;
        risk = _riskParams;

        emit GlobalParamsUpdated(params);
        emit RiskParamsUpdated(risk);
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
        emit GlobalParamsUpdated(params);
    }

    function setGlobalParams(
        Types.GlobalParams memory _globalParams
    )
        public
        onlyAdmin
    {
        params = _globalParams;
        emit GlobalParamsUpdated(params);
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
        SignedMath.Int memory amount
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
        SignedMath.Int memory amount
    )
        public
        onlyCore
        returns (Types.Position memory)
    {
        Types.Position storage position = positions[id];

        if (position.collateralAsset == asset) {
            position.collateralAmount = position.collateralAmount.combine(amount);
        } else {
            position.borrowedAmount = position.borrowedAmount.combine(amount);
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

        (SignedMath.Int memory collateralDelta) = calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            currentPrice
        );

        return collateralDelta.isPositive || collateralDelta.value == 0;
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
        returns (SignedMath.Int memory)
    {
        uint256 collateralRequired = calculateInverseAmount(
            asset,
            amount,
            price
        );

        if (asset == Types.AssetType.Collateral) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.collateralRatio
            );

        } else if (asset == Types.AssetType.Synthetic) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.collateralRatio
            );
        }

        return SignedMath.Int({
            isPositive: true,
            value: collateralRequired
        });
    }

    function calculateLiquidationPrice(
        Types.AssetType asset
    )
        public
        view
        returns (Decimal.D256 memory price)
    {
        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        uint256 totalSpread = params.liquidationUserFee.value.add(
            params.liquidationArcFee.value
        );

        if (asset == Types.AssetType.Collateral) {
            result = Decimal.add(
                Decimal.one(),
                totalSpread
            );
        } else if (asset == Types.AssetType.Synthetic) {
            result = Decimal.sub(
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
        SignedMath.Int memory supply,
        SignedMath.Int memory borrow,
        Decimal.D256 memory price
    )
        public
        view
        returns (SignedMath.Int memory)
    {
        SignedMath.Int memory collateralDelta;
        SignedMath.Int memory collateralRequired;

        if (borrowedAsset == Types.AssetType.Collateral) {
            collateralRequired = calculateInverseRequired(
                borrowedAsset,
                borrow.value,
                price
            );
        } else if (borrowedAsset == Types.AssetType.Synthetic) {
            collateralRequired = calculateInverseRequired(
                borrowedAsset,
                borrow.value,
                price
            );
        }

        collateralDelta = supply.sub(collateralRequired.value);

        return collateralDelta;
    }

}