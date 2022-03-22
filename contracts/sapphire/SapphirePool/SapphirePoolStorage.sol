// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IERC20Metadata} from "../../token/IERC20Metadata.sol";
import {SharedPoolStructs} from "./SharedPoolStructs.sol";

contract SapphirePoolStorage {
    /* ========== External ========== */
    
    /**
     * @notice Stores the total amount of stables borrowed by the cores. Stored in 18 decimals.
     */
    uint256 public creds;
    
    /* ========== Internal ========== */

    /**
     * @notice Determines the amount of tokens deposited by liquidity providers. Stored in 18
     * decimals.
     */
    mapping (address => uint256) internal _deposits;

    /**
     * @dev Determines the amount of creds the core can swap in. The amounts are stored in
     * 18 decimals.
     */
    mapping (address => SharedPoolStructs.AssetUtilization) internal _coreSwapUtilization;

    /**
     * @dev Determines the amount of tokens that can be deposited by
     * liquidity providers. The amounts are stored in the asset's native decimals.
     */
    mapping (address => SharedPoolStructs.AssetUtilization) internal _assetDepositUtilization;

    /**
     * @dev Stores the assets that have been historically allowed to be deposited.
     */
    address[] internal _knownDepositAssets;

    /**
     * @dev Stores the cores that have historically been approved to swap in assets.
     */
    address[] internal _knownCores;

    mapping (address => uint8) internal _tokenDecimals;
}
