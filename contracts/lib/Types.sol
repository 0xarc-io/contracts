pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {IOracle} from "../interfaces/IOracle.sol";
import {IInterestSetter} from "../interfaces/IInterestSetter.sol";

import {Math} from "./Math.sol";
import {Decimal} from "./Decimal.sol";
import {Interest} from "./Interest.sol";
import {SignedMath} from "./SignedMath.sol";

library Types {

    using Types for Types.Par;
    using Types for Types.Wei;
    using Math for uint256;
    using SafeMath for uint256;

    // ============ Structs ============

    struct GlobalParams {
        IERC20 stableAsset;
        IInterestSetter interestSetter;
        Decimal.D256 collateralRatio;
        Decimal.D256 syntheticRatio;
        Decimal.D256 liquidationSpread;
        Decimal.D256 originationFee;
        Decimal.D256 earningsRate;
        IOracle oracle;
    }

    struct State {
        Types.TotalPar totalPar;
        Interest.Index index;
    }

    struct Position {
        address owner;
        AssetType collateralAsset;
        AssetType borrowedAsset;
        Par collateralAmount;
        Par borrowedAmount;
    }

    // ============ AssetAmount ============

    enum AssetType {
        Stable,
        Synthetic
    }

    enum AssetDenomination {
        Wei, // the amount is denominated in wei
        Par  // the amount is denominated in par
    }

    enum AssetReference {
        Delta, // the amount is given as a delta from the current value
        Target // the amount is given as an exact number to end up at
    }

    struct AssetAmount {
        bool sign; // true if positive
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }

    // ============ ArcAsset ============

    function oppositeAsset(
        AssetType assetType
    )
        internal
        pure
        returns (AssetType)
    {
        return assetType == AssetType.Stable ? AssetType.Synthetic : AssetType.Stable;
    }

    function calculateInverseAmount(
        AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        internal
        view
        returns (uint256)
    {
        uint256 borrowRequired;

        if (asset == AssetType.Stable) {
            borrowRequired = Decimal.div(
                amount,
                price
            );
        } else if (asset == AssetType.Synthetic) {
            borrowRequired = Decimal.mul(
                amount,
                price
            );
        }

        return borrowRequired;
    }

    function calculateInverseRequired(
        AssetType asset,
        GlobalParams memory params,
        uint256 amount,
        Decimal.D256 memory price
    )
        internal
        view
        returns (uint256)
    {

        uint256 collateralRequired = calculateInverseAmount(
            asset,
            amount,
            price
        );

        if (asset == AssetType.Stable) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.syntheticRatio
            );

        } else if (asset == AssetType.Synthetic) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.collateralRatio
            );
        }

        return collateralRequired;
    }

    function calculateLiquidationPrice(
        AssetType asset,
        GlobalParams memory params
    )
        internal
        view
        returns (Decimal.D256 memory price)
    {
        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        if (asset == AssetType.Stable) {
            result = Decimal.add(
                Decimal.one(),
                params.liquidationSpread.value
            );
        } else if (asset == AssetType.Synthetic) {
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
        GlobalParams memory params,
        Types.Par memory parSupply,
        Types.Par memory parBorrow,
        Interest.Index memory borrowIndex,
        Decimal.D256 memory price
    )
        internal
        view
        returns (SignedMath.Int memory)
    {
        SignedMath.Int memory collateralDelta;

        uint256 collateralRequired;

        Types.Wei memory weiBorrow = getWei(
            parBorrow,
            borrowIndex
        );

        console.log("Wei borrow: %s", weiBorrow.value);

        if (borrowedAsset == Types.AssetType.Stable) {
            collateralRequired = Types.calculateInverseRequired(
                borrowedAsset,
                params,
                weiBorrow.value,
                price
            );
        } else if (borrowedAsset == Types.AssetType.Synthetic) {
            collateralRequired = Types.calculateInverseRequired(
                borrowedAsset,
                params,
                weiBorrow.value,
                price
            );
        }

        console.log("Par supply: %s", parSupply.value);

        // If the amount you've supplied is greater than the collateral needed
        // given your borrow amount, then you're positive
        if (parSupply.value >= collateralRequired) {
            collateralDelta = SignedMath.Int({
                isPositive: true,
                value: uint256(parSupply.value).sub(collateralRequired)
            });
        } else {
            // If not, subtract the collateral needed from the amount supplied
            collateralDelta = SignedMath.Int({
                isPositive: false,
                value: collateralRequired.sub(uint256(parSupply.value))
            });
        }

        console.log("Collateral delta: %s %s", collateralDelta.isPositive, collateralDelta.value);

        return collateralDelta;
    }

    // ============ Par (Principal Amount) ============

    // Total borrow and supply values for a market
    struct TotalPar {
        uint128 borrow;
        uint128 supply;
    }

    // Individual principal amount for an account
    struct Par {
        bool sign; // true if positive
        uint128 value;
    }

    function zeroPar()
        internal
        pure
        returns (Par memory)
    {
        return Par({
            sign: false,
            value: 0
        });
    }

    function positiveZeroPar()
        internal
        pure
        returns (Par memory)
    {
        return Par({
            sign: true,
            value: 0
        });
    }

    function sub(
        Par memory a,
        Par memory b
    )
        internal
        pure
        returns (Par memory)
    {
        return add(a, negative(b));
    }

    function add(
        Par memory a,
        Par memory b
    )
        internal
        pure
        returns (Par memory)
    {
        Par memory result;
        if (a.sign == b.sign) {
            result.sign = a.sign;
            result.value = SafeMath.add(a.value, b.value).to128();
        } else {
            if (a.value >= b.value) {
                result.sign = a.sign;
                result.value = SafeMath.sub(a.value, b.value).to128();
            } else {
                result.sign = b.sign;
                result.value = SafeMath.sub(b.value, a.value).to128();
            }
        }
        return result;
    }

    function equals(
        Par memory a,
        Par memory b
    )
        internal
        pure
        returns (bool)
    {
        if (a.value == b.value) {
            if (a.value == 0) {
                return true;
            }
            return a.sign == b.sign;
        }
        return false;
    }

    function negative(
        Par memory a
    )
        internal
        pure
        returns (Par memory)
    {
        return Par({
            sign: !a.sign,
            value: a.value
        });
    }

    function isNegative(
        Par memory a
    )
        internal
        pure
        returns (bool)
    {
        return !a.sign && a.value > 0;
    }

    function isPositive(
        Par memory a
    )
        internal
        pure
        returns (bool)
    {
        return a.sign && a.value > 0;
    }

    function isZero(
        Par memory a
    )
        internal
        pure
        returns (bool)
    {
        return a.value == 0;
    }

    // ============ Wei (Token Amount) ============

    // Individual token amount for an account
    struct Wei {
        bool sign; // true if positive
        uint256 value;
    }

    function zeroWei()
        internal
        pure
        returns (Wei memory)
    {
        return Wei({
            sign: false,
            value: 0
        });
    }

    function sub(
        Wei memory a,
        Wei memory b
    )
        internal
        pure
        returns (Wei memory)
    {
        return add(a, negative(b));
    }

    function add(
        Wei memory a,
        Wei memory b
    )
        internal
        pure
        returns (Wei memory)
    {
        Wei memory result;
        if (a.sign == b.sign) {
            result.sign = a.sign;
            result.value = SafeMath.add(a.value, b.value);
        } else {
            if (a.value >= b.value) {
                result.sign = a.sign;
                result.value = SafeMath.sub(a.value, b.value);
            } else {
                result.sign = b.sign;
                result.value = SafeMath.sub(b.value, a.value);
            }
        }
        return result;
    }

    function equals(
        Wei memory a,
        Wei memory b
    )
        internal
        pure
        returns (bool)
    {
        if (a.value == b.value) {
            if (a.value == 0) {
                return true;
            }
            return a.sign == b.sign;
        }
        return false;
    }

    function negative(
        Wei memory a
    )
        internal
        pure
        returns (Wei memory)
    {
        return Wei({
            sign: !a.sign,
            value: a.value
        });
    }

    function isNegative(
        Wei memory a
    )
        internal
        pure
        returns (bool)
    {
        return !a.sign && a.value > 0;
    }

    function isPositive(
        Wei memory a
    )
        internal
        pure
        returns (bool)
    {
        return a.sign && a.value > 0;
    }

    function isZero(
        Wei memory a
    )
        internal
        pure
        returns (bool)
    {
        return a.value == 0;
    }

    function getWei(
        Par memory par,
        Interest.Index memory index
    )
        internal
        pure
        returns (Types.Wei memory)
    {
        if (isZero(par)) {
            return Types.zeroWei();
        }

        return Interest.parToWei(par, index);
    }

    function getNewParAndDeltaWei(
        Types.Par memory currentPar,
        Interest.Index memory index,
        Types.AssetAmount memory amount
    )
        internal
        view
        returns (Types.Par memory, Types.Wei memory)
    {
        if (amount.value == 0 && amount.ref == Types.AssetReference.Delta) {
            return (currentPar, Types.zeroWei());
        }

        Types.Wei memory oldWei = Interest.parToWei(currentPar, index);
        Types.Par memory newPar;
        Types.Wei memory deltaWei;

        if (amount.denomination == Types.AssetDenomination.Wei) {
            deltaWei = Types.Wei({
                sign: amount.sign,
                value: amount.value
            });
            if (amount.ref == Types.AssetReference.Target) {
                deltaWei = deltaWei.sub(oldWei);
            }
            newPar = Interest.weiToPar(oldWei.add(deltaWei), index);
        } else { // AssetDenomination.Par
            newPar = Types.Par({
                sign: amount.sign,
                value: amount.value.to128()
            });
            if (amount.ref == Types.AssetReference.Delta) {
                newPar = currentPar.add(newPar);
            }
            deltaWei = Interest.parToWei(newPar, index).sub(oldWei);
        }

        return (newPar, deltaWei);
    }

}
