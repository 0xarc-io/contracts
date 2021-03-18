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

    event MapperSet(address _newMapper);

    event CreditScoreContractSet(address _newCreditScoreContract);

    event Assessed(uint256 _assessedValue);

    /* ========== Functions ========== */

    constructor(
        address _mapper,
        address _creditScore
    )
        public
    {
        require(
            _mapper != address(0) &&
            _creditScore != address(0),
            "SapphireAssessor: The mapper and the credit score addresses cannot be null"
        );

        mapper = ISapphireMapper(_mapper);
        creditScoreContract = ISapphireCreditScore(_creditScore);
    }

    /**
     * @notice Takes a lower and upper bound, and based on the user's credit score
     * and given its proof, returns the appropriate value between these bounds.
     *
     * @param _lowerBound The lower bound
     * @param _upperBound The upper bound
     * @param _scoreProof The score proof
     * @param _isScoreRequred The flag, which require the proof of score if account already has some score 
     * @return A value between the lower and upper bounds depending on the credit score
     */
    function assess(
        uint256 _lowerBound,
        uint256 _upperBound,
        SapphireTypes.ScoreProof memory _scoreProof,
        bool _isScoreRequred
    )
        public
        returns (uint256)
    {
        require(
            _upperBound > 0,
            "SapphireAssessor: The upper bound cannot be empty"
        );

        require(
            _scoreProof.account != address(0),
            "SapphireAssessor: The account cannot be empty"
        );

        require(
            _lowerBound < _upperBound,
            "SapphireAssessor: The lower bound exceeds the upper bound"
        );

        uint256 creditScore;
        uint16 maxScore;

        (creditScore, maxScore,) = creditScoreContract.getLastScore(_scoreProof.account);
        bool isProofPassed = _scoreProof.merkleProof.length > 0;

        // If credit score is required and user has already verified the score than require proof of score
        if (_isScoreRequred && creditScore > 0) {
            require(
                isProofPassed,
                "SapphireAssessor: proof should be provided for credit score"
            );
        }

        // If there's proof passed, use the updated credit score instead of the latest credit score
        if (isProofPassed) {
            (creditScore, maxScore) = creditScoreContract.verifyAndUpdate(_scoreProof);
        }

        uint256 result = mapper.map(
            creditScore,
            maxScore,
            _lowerBound,
            _upperBound
        );

        require(
            result >= _lowerBound &&
            result <= _upperBound,
            "SapphireAssessor: The mapper returned a value out of bounds"
        );

        emit Assessed(result);

        return result;
    }

    function setMapper(
        address _mapper
    )
        public
        onlyOwner
    {
        require(
            _mapper != address(0),
            "SapphireAssessor: The new mapper cannot be null"
        );

        require(
            _mapper != address(mapper),
            "SapphireAssessor: The same mapper is already set"
        );

        mapper = ISapphireMapper(_mapper);

        emit MapperSet(mapper);
    }

    function setCreditScoreContract(
        address _creditScore
    )
        public
        onlyOwner
    {
        require(
            _creditScore != address(0),
            "SapphireAssessor: The new credit score contract address cannot be null"
        );

        require(
            _creditScore != address(creditScoreContract),
            "SapphireAssessor: The same credit score contract is already set"
        );

        creditScoreContract = ISapphireCreditScore(_creditScore);

        emit CreditScoreContractSet(creditScoreContract);
    }
}
