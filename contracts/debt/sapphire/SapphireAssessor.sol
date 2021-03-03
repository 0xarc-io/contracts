// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireTypes} from "./SapphireTypes.sol";
import {ISapphireMapper} from "./ISapphireMapper.sol";
import {ISapphireCreditScore} from "./ISapphireCreditScore.sol";
import {Ownable} from "../../lib/Ownable.sol";

contract SapphireAssessor is Ownable {

    /* ========== Variables ========== */

    ISapphireMapper public mapper;

    ISapphireCreditScore public creditScoreContract;

    /* ========== Events ========== */

    event MapperSet(address newMapper);

    event CreditScoreContractSet(address newCreditScoreContract);

    /* ========== Functions ========== */

    constructor(
        address _mapper,
        address _creditScore
    )
        public
    {

    }

    /**
     * @notice Takes a lower and upper bound, and based on the user's credit score
     * and given its proof, returns the appropriate value between these bounds.
     *
     * @param _lowerBound The lower bound
     * @param _upperBound The upper bound
     * @param _scoreProof The score proof
     * @return A value between the lower and upper bounds depending on the credit score
     */
    function assess(
        uint256 _lowerBound,
        uint256 _upperBound,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        returns (uint256)
    {
        // Get the credit score
        // Send it to the mapper
        // Send the result from  the mapper
    }

    function setMapper(
        address _mapper
    )
        public
        onlyOwner
    {

    }

    function setCreditScoreContract(
        address _creditScore
    )
        public
        onlyOwner
    {

    }
}
