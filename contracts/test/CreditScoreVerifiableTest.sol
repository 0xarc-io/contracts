// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {CreditScoreVerifiable} from "../lib/CreditScoreVerifiable.sol";
import {SapphireTypes} from "../debt/sapphire/SapphireTypes.sol";

contract CreditScoreVerifiableTest is CreditScoreVerifiable {
    
    event DidSomethingAndProofPassed();
    event DidSomethingOptionalProof();
    
    constructor(
        address _creditScoreContract
    )
        public
        CreditScoreVerifiable(_creditScoreContract)
    {}

    function proofRequiredDoSomething(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, true)
    {
        emit DidSomethingAndProofPassed();
    }
    
    function proofOptionalDoSomething(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false)
    {
        emit DidSomethingOptionalProof();
    }
}
