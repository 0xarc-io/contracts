// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphireTypes} from "./SapphireTypes.sol";

contract FlashLiquidator {
    function liquidate(
        address _owner,
        address _borrowAssetAddress,
        SapphireTypes.ScoreProof memory _creditScoreProof
    )
        public
    {
        revert("not implemented");
    }
}
