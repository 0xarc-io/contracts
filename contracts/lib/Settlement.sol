pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

import {Types} from "./Types.sol";

library Settlement {

    function borrow(
        Types.GlobalParams memory params,
        ISyntheticToken synthetic,
        Types.AssetType borrowedAsset,
        uint256 collateralAmount,
        uint256 borrowedAmount
    ) internal {
        if (borrowedAsset == Types.AssetType.Synthetic) {
            SafeERC20.safeTransferFrom(
                params.stableAsset,
                msg.sender,
                address(synthetic),
                collateralAmount
            );

            synthetic.mint(
                msg.sender,
                borrowedAmount
            );
        }

        if (borrowedAsset == Types.AssetType.Stable) {
            SafeERC20.safeTransferFrom(
                IERC20(address(synthetic)),
                msg.sender,
                address(this),
                collateralAmount
            );

            SafeERC20.safeTransfer(
                params.stableAsset,
                msg.sender,
                borrowedAmount
            );
        }
    }

    function liquidate(
        Types.GlobalParams memory params,
        ISyntheticToken synthetic,
        Types.AssetType collateralAsset,
        uint256 collateralToLiquidate,
        Types.AssetType borrowedAsset,
        uint256 borrowToLiquidate
    ) internal {
        if (collateralAsset == Types.AssetType.Synthetic) {
            synthetic.burn(
                msg.sender,
                borrowToLiquidate
            );

            synthetic.transferCollateral(
                address(params.stableAsset),
                msg.sender,
                collateralToLiquidate
            );
        }

        if (borrowedAsset == Types.AssetType.Stable) {
            SafeERC20.safeTransferFrom(
                params.stableAsset,
                msg.sender,
                address(this),
                borrowToLiquidate
            );

            SafeERC20.safeTransfer(
                IERC20(address(synthetic)),
                msg.sender,
                collateralToLiquidate
            );
        }
    }

}