// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";


/**
 * @title SignedMath
 * @author dYdX
 *
 * @dev SignedMath library for doing math with signed integers.
 */
library SignedMath {

    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;

    // ============ Structs ============

    struct Int {
        uint256 value;
        bool isPositive;
    }

    // ============ Functions ============

    function zero()
        internal
        pure
        returns (Int memory)
    {
        return Int({
            value: 0,
            isPositive: true
        });
    }

    function combine(
        Int memory sint1,
        Int memory sint2
    )
        internal
        pure
        returns (Int memory)
    {
        if (sint2.isPositive) {
            return sint1.add(sint2.value);
        } else {
            return sint1.sub(sint2.value);
        }
    }

    /**
     * @dev Returns a new signed integer equal to a signed integer plus an unsigned integer.
     */
    function add(
        Int memory sint,
        uint256 value
    )
        internal
        pure
        returns (Int memory)
    {
        if (sint.isPositive) {
            return Int({
                value: value.add(sint.value),
                isPositive: true
            });
        }
        if (sint.value < value) {
            return Int({
                value: value.sub(sint.value),
                isPositive: true
            });
        }
        return Int({
            value: sint.value.sub(value),
            isPositive: false
        });
    }

    /**
     * @dev Returns a new signed integer equal to a signed integer minus an unsigned integer.
     */
    function sub(
        Int memory sint,
        uint256 value
    )
        internal
        pure
        returns (Int memory)
    {
        if (!sint.isPositive) {
            return Int({
                value: value.add(sint.value),
                isPositive: false
            });
        }
        if (sint.value > value) {
            return Int({
                value: sint.value.sub(value),
                isPositive: true
            });
        }
        return Int({
            value: value.sub(sint.value),
            isPositive: false
        });
    }

    /**
     * @dev Returns true if signed integer `a` is greater than signed integer `b`, false otherwise.
     */
    function gt(
        Int memory a,
        Int memory b
    )
        internal
        pure
        returns (bool)
    {
        if (a.isPositive) {
            if (b.isPositive) {
                return a.value > b.value;
            } else {
                // True, unless both values are zero.
                return a.value != 0 || b.value != 0;
            }
        } else {
            if (b.isPositive) {
                return false;
            } else {
                return a.value < b.value;
            }
        }
    }

    /**
     * @dev Returns the minimum of signed integers `a` and `b`.
     */
    function min(
        Int memory a,
        Int memory b
    )
        internal
        pure
        returns (Int memory)
    {
        return gt(b, a) ? a : b;
    }

    /**
     * @dev Returns the maximum of signed integers `a` and `b`.
     */
    function max(
        Int memory a,
        Int memory b
    )
        internal
        pure
        returns (Int memory)
    {
        return gt(a, b) ? a : b;
    }
}