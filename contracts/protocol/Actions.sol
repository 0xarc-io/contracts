pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {BaseERC20} from "../token/BaseERC20.sol";

import {Storage} from "./Storage.sol";

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

        updateIndexes();
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

        state.supplyTotal = state.supplyTotal.sub(amount);
        supplyBalances[msg.sender] = supplyBalances[msg.sender].sub(amount);

        updateIndexes();
    }

    function openPosition(
        address collateralAsset,
        uint256 borrowAmount
    )
        public
    {
        address syntheticAsset = address(synthetic);

        require(
            collateralAsset == syntheticAsset || collateralAsset == params.stableAsset,
            "Actions.openPosition: Can only use stable shares or the synthetic as collateral"
        );

        require(
            borrowAmount > 0,
            "Actions.openPosition: Cannot open a 0 position"
        );

        address assetToBorrow = collateralAsset == syntheticAsset ? params.stableAsset : syntheticAsset;

        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        uint256 requiredCollateral = 0;
        uint256 stableSharesInvolved = 0;

        if (assetToBorrow == syntheticAsset) {
            requiredCollateral = Decimal.mul(
                borrowAmount,
                currentPrice
            );

            requiredCollateral = Decimal.mul(
                requiredCollateral,
                params.collateralRatio
            );

            stableSharesInvolved = requiredCollateral;
        }

        if (assetToBorrow == params.stableAsset) {
            requiredCollateral = Decimal.div(
                borrowAmount,
                currentPrice
            );

            requiredCollateral = Decimal.mul(
                requiredCollateral,
                params.syntheticRatio
            );

            stableSharesInvolved = requiredCollateral;
        }

        require(
            IERC20(collateralAsset).balanceOf(msg.sender) >= requiredCollateral,
            "Actions.openPosition: Not enough collateral provided"
        );

        SafeERC20.safeTransferFrom(
            IERC20(collateralAsset),
            msg.sender,
            syntheticAsset,
            requiredCollateral
        );

        Types.Position memory newPosition = Types.Position({
            collateralAsset: collateralAsset,
            collateralAmount: requiredCollateral,
            borrowedAsset: assetToBorrow,
            borrowedAmount: borrowAmount
        });

        positions[positionCount] = newPosition;

        if (assetToBorrow == syntheticAsset) {
            synthetic.mint(msg.sender, borrowAmount);
        }

        if (assetToBorrow == params.stableAsset) {
            state.borrowTotal = state.borrowTotal.add(borrowAmount);

            SafeERC20.safeTransfer(
                IERC20(params.stableAsset),
                msg.sender,
                borrowAmount
            );
        }

        positionCount = positionCount + 1;

        updateIndexes();
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

    // ============ Helpers ============

    function utilisationRatio()
        public
        view
        returns (Decimal.D256 memory)
    {
        if (state.borrowTotal == 0) {
            return Decimal.D256({ value: 0 });
        }

        uint256 invertedResult = state.supplyTotal.div(state.borrowTotal);
        uint256 result = Decimal.BASE.div(invertedResult);

        return Decimal.D256({ value: result });
    }

    function updateIndexes()
        public
    {
        require(
            utilisationRatio().value <= params.maximumUtilisationRatio.value,
            "Arc: maximum utilisation ratio reached"
        );
    }
}
