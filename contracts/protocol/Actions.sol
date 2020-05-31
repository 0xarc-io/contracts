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
            "Actions.supply: Cannot supply 0"
        );

        SafeERC20.safeTransferFrom(
            IERC20(params.stableAsset),
            msg.sender,
            address(this),
            amount
        );

        state.supplyTotal = state.supplyTotal.add(amount);
        supplyBalances[msg.sender] = supplyBalances[msg.sender].add(amount);

        // @TODO: Update indexes
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

        require(
            supplyBalances[msg.sender] >= amount,
            "Actions.withdraw: Cannot withdraw more than supplied"
        );

        SafeERC20.safeTransfer(
            IERC20(params.stableAsset),
            msg.sender,
            amount
        );

        // @TODO: Calculate interest earned to withdraw

        // @TODO: Ensure there's enough liquidity in the protocol

        state.supplyTotal = state.supplyTotal.sub(amount);
        supplyBalances[msg.sender] = supplyBalances[msg.sender].sub(amount);

        // @TODO: Update indexes
    }

    function openPosition(
        address collateralAsset,
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        public
    {
        require(
            collateralAsset == address(this) || collateralAsset == params.stableAsset,
            "Actions.openPosition: Can only use stable shares or the synthetic as collateral"
        );

        require(
            borrowAmount > 0,
            "Actions.openPosition: Cannot open a 0 position"
        );
    }

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
