pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {Storage} from "./Storage.sol";
import {Types} from "../lib/Types.sol";

contract Actions is Storage {

    using SafeMath for uint256;

    // ============ Functions ============

    function supply(
        uint256 amount
    )
        public
    {
        require(
            amount > 0,
            "Actions.supply(): Cannot supply 0"
        );

        SafeERC20.safeTransferFrom(
            IERC20(params.stableAsset),
            msg.sender,
            address(this),
            amount
        );

        state.supplyTotal = state.supplyTotal.add(amount);
        supplyBalances[msg.sender] = supplyBalances[msg.sender].add(amount);
    }

    function withdraw(
        uint256 amount
    )
        public
    {
        require(
            amount > 0,
            "Actions.withdraw: Cannot withdraw 0"
        );
    }

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
