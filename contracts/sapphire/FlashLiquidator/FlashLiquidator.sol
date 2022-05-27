// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import {Math} from "../../lib/Math.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {IERC20Metadata} from "../../token/IERC20Metadata.sol";
import {ISapphireCoreV1} from "./ISapphireCoreV1.sol";
import {SapphireTypes} from "../SapphireTypes.sol";

// TODO to rm
import "hardhat/console.sol";

contract FlashLiquidator is FlashLoanSimpleReceiverBase {

    struct LiquidationVariables {
        address vaultOwner;
        SapphireTypes.ScoreProof[] proofs;
        ISapphireCoreV1 core;
        address collateralAsset;
        address profitReceiver;
        IUniswapV3Pool pool;
    }

    constructor() { 
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb));
    }
    
    function liquidate(
        address _core,
        address _owner,
        address _borrowAssetAddress,
        SapphireTypes.ScoreProof memory _creditScoreProof,
        address _uniswapPool
    )
        public
    {
        ISapphireCoreV1 core = ISapphireCoreV1(_core);

        // get user's current debt
        SapphireTypes.Vault memory vault = core.vaults(_owner);
        uint256 outstandingDebt = Math.roundUpMul(
            vault.normalizedBorrowedAmount,
            core.currentBorrowIndex()
        );
        uint8 assetDecimals = IERC20Metadata(_borrowAssetAddress).decimals();
        uint256 precisionScalar = 10 ** (18 - uint256(assetDecimals));
        uint256 outstandingDebtScaled = outstandingDebt / precisionScalar;
            

        // get a flash loan of the amount of the current debt
        bytes memory params = abi.encode(
            msg.sender,
            _core,
            _owner,
            _creditScoreProof,
            _uniswapPool
        );
        POOL.flashLoanSimple(
            address(this), 
            _borrowAssetAddress, 
            outstandingDebtScaled, 
            params, 
            0
        );
    }

    /**
     * @dev Is called by the aave pool after the funds have been transferred.
     * This function executes the liquidation
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator, // solhint-disable-line no-unused-vars
        bytes calldata params
    )
        external
        override
        returns (bool)
    {
        LiquidationVariables memory liquidationVars = _getVariablesForLiquidation(params);
        
        _executeLiquidation(
            liquidationVars, 
            asset, 
            amount
        );
        
        // swap the collateral for the borrow asset address
        liquidationVars.pool.swap(
            address(this),
            false, // pool is STABLE/COLLATERAL, so the direction of the swap is 1 to 0
            int256(IERC20Metadata(liquidationVars.collateralAsset).balanceOf(address(this))),
            0,
            ""
        );

        // Approve the loan for repayment
        uint256 loanRepaymentAmount = amount + premium;
        SafeERC20.safeApprove(
            IERC20Metadata(asset),
            address(POOL),
            loanRepaymentAmount
        );

        // transfer profit to sender
        SafeERC20.safeTransfer(
            IERC20Metadata(asset),
            liquidationVars.profitReceiver,
            IERC20Metadata(asset).balanceOf(address(this)) - loanRepaymentAmount
        );

        return true;
    }

    function _executeLiquidation(
        LiquidationVariables memory liquidationVars,
        address _loanAsset,
        uint256 _loanAmount
    )
        internal
    {
        // approve the loan to the vault
        SafeERC20.safeApprove(
            IERC20Metadata(_loanAsset),
            address(liquidationVars.core),
            _loanAmount
        );

        // liquidate position
        liquidationVars.core.liquidate(
            liquidationVars.vaultOwner,
            _loanAsset,
            liquidationVars.proofs
        );
    }

    function _getVariablesForLiquidation(
        bytes memory _params
    )
        internal
        returns (LiquidationVariables memory)
    {
        (
            address profitReceiver,
            address coreAddress,
            address vaultOwner,
            SapphireTypes.ScoreProof memory creditScoreProof,
            address uniswapPoolAddress
        ) = abi.decode(_params, (
            address,
            address,
            address,
            SapphireTypes.ScoreProof,
            address
        ));
        ISapphireCoreV1 core = ISapphireCoreV1(coreAddress);
        IUniswapV3Pool pool = IUniswapV3Pool(uniswapPoolAddress);

        SapphireTypes.ScoreProof[] memory proofs = new SapphireTypes.ScoreProof[](1);
        proofs[0] = creditScoreProof;

        return LiquidationVariables(
            vaultOwner,
            proofs,
            core,
            core.collateralAsset(),
            profitReceiver,
            pool
        );
    }
}
