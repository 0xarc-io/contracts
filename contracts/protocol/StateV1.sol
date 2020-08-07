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

    uint256 public positionCount;
    uint256 public totalSupplied;

    mapping (uint256 => Types.Position) public positions;

    // ============ Events ============

    event GlobalParamsUpdated(Types.GlobalParams updatedParams);

    // ============ Constructor ============

    constructor(
        address _core,
        address _admin,
        Types.GlobalParams memory _globalParams,
        Types.RiskParams memory _riskParams
    )
        public
    {
        core = _core;
        admin = _admin;
        params = _globalParams;
        risk = _riskParams;

        emit GlobalParamsUpdated(params);
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
        params.oracle = IOracle(_oracle);
        emit GlobalParamsUpdated(params);
    }

    function setCollateralRatio(
        Decimal.D256 memory ratio
    )
        public
        onlyAdmin
    {
        params.collateralRatio = ratio;
        emit GlobalParamsUpdated(params);
    }

    function setSyntheticRatio(
        Decimal.D256 memory ratio
    )
        public
        onlyAdmin
    {
        params.syntheticRatio = ratio;
        emit GlobalParamsUpdated(params);
    }

    function setLiquidationSpread(
        Decimal.D256 memory spread
    )
        public
        onlyAdmin
    {
        params.liquidationSpread = spread;
        emit GlobalParamsUpdated(params);
    }

    function setOriginationFee(
        Decimal.D256 memory fee
    )
        public
        onlyAdmin
    {
        params.originationFee = fee;
        emit GlobalParamsUpdated(params);
    }

    function removeExcessTokens(
        address to
    )
        public
        onlyAdmin
    {
        params.collateralAsset.transfer(
            to,
           getExcessStableTokens()
        );
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
            address(params.collateralAsset) :
            address(params.syntheticAsset);
    }

    function getcollateralAsset()
        public
        view
        returns (IERC20)
    {
        return params.collateralAsset;
    }

    function getSyntheticAsset()
        public
        view
        returns (IERC20)
    {
        return IERC20(address(params.syntheticAsset));
    }

    function getSupplyBalance(
        address owner
    )
        public
        view
        returns (SignedMath.Int memory)
    {
        return SignedMath.Int({
            isPositive: true,
            value: IERC20(address(params.collateralAsset)).balanceOf(owner).to128()
        });
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
        return params.oracle.fetchCurrentPrice();
    }

    function getExcessStableTokens()
        internal
        view
        returns (uint256)
    {
        return params.collateralAsset.balanceOf(address(this)).sub(totalSupplied);
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

        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

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
                params.syntheticRatio
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
        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        if (asset == Types.AssetType.Collateral) {
            result = Decimal.add(
                Decimal.one(),
                params.liquidationSpread.value
            );
        } else if (asset == Types.AssetType.Synthetic) {
            result = Decimal.sub(
                Decimal.one(),
                params.liquidationSpread.value
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