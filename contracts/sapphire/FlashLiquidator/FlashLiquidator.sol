// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {IFlashLoanSimpleReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";

import {ISapphireCoreV1} from "./ISapphireCoreV1.sol";
import {SapphireTypes} from "../SapphireTypes.sol";

contract FlashLiquidator is IFlashLoanSimpleReceiver {

    IPoolAddressesProvider public ADDRESSES_PROVIDER = 
        IPoolAddressesProvider(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);

    IPool public POOL = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
    
    ISapphireCoreV1 public core;
    
    constructor(address _coreAddress) {
        core = ISapphireCoreV1(_coreAddress);
    }
    
    function liquidate(
        address _owner,
        address _borrowAssetAddress,
        SapphireTypes.ScoreProof memory _creditScoreProof
    )
        public
    {
        // get user's vault
        SapphireTypes.Vault memory vault = core.vaults(_owner);

        // get a flash loan of the amount of the current debt

        // approve the loan to the vault

        // liquidate position

        // swap the collateral for the borrow asset address

        // repay the loan

        // transfer profit to sender
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
        revert("not implemented");
    }
}
