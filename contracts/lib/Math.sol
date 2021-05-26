// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "./SafeMath.sol";

/**
 * @title Math
 *
 * Library for non-standard Math functions
 */
library Math {
    using SafeMath for uint256;

    // ============ Library Functions ============

    /*
     * Return target * (numerator / denominator).
     */
    function getPartial(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        internal
        pure
        returns (uint256)
    {
        return target.mul(numerator).div(denominator);
    }

    function to128(
        uint256 number
    )
        internal
        pure
        returns (uint128)
    {
        uint128 result = uint128(number);
        require(
            result == number,
            "Math: Unsafe cast to uint128"
        );
        return result;
    }

    function min(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        return a < b ? a : b;
    }

    function max(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        return a > b ? a : b;
    }

    /**
     * @dev Performs a / b, but rounds up instead
     */
    function roundUpDiv(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        uint256 BASE = 10**18;
        uint256 basedAmount = a.mul(BASE.mul(10));

        return basedAmount
            .div(b)
            .add(5)
            .div(10);
    }

    /**
     * @dev Performs _a * _b / BASE, but rounds up instead
     */
    function roundUpMul(
        uint256 a,
        uint256 b
    )
        internal
        pure
        returns (uint256)
    {
        uint256 BASE = 10**18;
        return a
            .mul(b)
            .add(BASE)
            .div(BASE);
    }
}
