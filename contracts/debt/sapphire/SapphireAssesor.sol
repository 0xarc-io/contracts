// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireAssesor {

    /* ========== Variables ========== */

    address public mapper;

    address public creditScore;

    /* ========== Functions ========== */

    constructor(
        address _mapper,
        address _creditScore
    )
        public
    {

    }

    function assess(
        uint256 variableOne,
        uint256 variableTwo,
        SapphireTypes.ScoreProof memory scoreProof
    )
        public
        returns (uint256)
    {
        // Get the credit score
        // Send it to the mapper
        // Send the result from  the mapper
    }

}
