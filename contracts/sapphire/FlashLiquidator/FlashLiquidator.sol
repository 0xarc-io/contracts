// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";

import {Math} from "../../lib/Math.sol";
import {IERC20Metadata} from "../../token/IERC20Metadata.sol";
import {ISapphireCoreV1} from "./ISapphireCoreV1.sol";
import {SapphireTypes} from "../SapphireTypes.sol";

import "hardhat/console.sol";

contract FlashLiquidator is FlashLoanSimpleReceiverBase {

    ISapphireCoreV1 public core;
    
    constructor(address _coreAddress)
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb))
    {
        core = ISapphireCoreV1(_coreAddress);
    }
    
    function liquidate(
        address _owner,
        address _borrowAssetAddress,
        SapphireTypes.ScoreProof memory _creditScoreProof
    )
        public
    {
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
            _owner,
            _borrowAssetAddress,
            _creditScoreProof
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
        address initiator,
        bytes calldata params
    )
        external
        override
        returns (bool)
    {
        console.log("executing operation!");
        // approve the loan to the vault

        // liquidate position

        // swap the collateral for the borrow asset address

        // repay the loan

        // transfer profit to sender
    }
}
