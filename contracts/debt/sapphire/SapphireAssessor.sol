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

    event Assessed(uint256 assessedValue);

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
            "The mapper and the credit score addresses cannot be null"
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
        require(
            _upperBound > 0,
            "The upper bound cannot be empty"
        );

        require(
            _scoreProof.account != address(0),
            "The account cannot be empty"
        );

        require(
            _lowerBound < _upperBound,
            "The lower bound must be smaller than the upper bound"
        );

        uint256 creditScore;
        uint16 maxScore;
        
        // If there's no proof passed, use the latest credit score
        if (_scoreProof.merkleProof.length == 0) {
            (creditScore, maxScore,) = creditScoreContract.getLastScore(_scoreProof.account);
        } else {
            (creditScore, maxScore) = creditScoreContract.request(_scoreProof);
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
            "The mapper returned a value outside the lower and upper bounds"
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
            "The new mapper cannot be null"
        );

        require(
            _mapper != address(mapper),
            "The same mapper is already set"
        );

        mapper = ISapphireMapper(_mapper);
    }

    function setCreditScoreContract(
        address _creditScore
    )
        public
        onlyOwner
    {
        require(
            _creditScore != address(0),
            "The new credit score contract address cannot be null"
        );

        require(
            _creditScore != address(creditScoreContract),
            "The same credit score contract is already set"
        );

        creditScoreContract = ISapphireCreditScore(_creditScore);
    }
}
