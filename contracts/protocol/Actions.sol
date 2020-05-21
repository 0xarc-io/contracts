pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import {Storage} from "./Storage.sol";
import {Types} from "../lib/Types.sol";

contract Actions is Storage {

    // ============ Functions ============

    function supply(
        uint256 amount
    ) public {}

    function withdraw(
        uint256 amount
    ) public {}

    function openPosition(
        address collateralAsset,
        uint256 collateralAmount,
        uint256 borrowAmount
    ) public {}

    function borrowPosition(
        uint256 positionId,
        uint256 borrowAmount
    ) public {}

    function depositPosition(
        uint256 positionId,
        uint256 depositAmount,
        address depositAsset
    ) public {}

    function closePosition(
        uint256 positionId,
        address interestRepaymentAsset
    ) public {}

    function liquidatePosition(
        uint256 positionId
    ) public {}

    function supplyAsLP(
        uint256 amount
    ) public {}

    function withdrawAsLP(
        uint256 amount
    ) public {}

    function swap(
        address input,
        uint256 amount,
        uint256 minimumOutput
    ) public {}
}
