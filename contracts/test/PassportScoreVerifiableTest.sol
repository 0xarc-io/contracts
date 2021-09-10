// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {PassportScoreVerifiable} from "../lib/PassportScoreVerifiable.sol";
import {ISapphirePassportScores} from "../sapphire/ISapphirePassportScores.sol";
import {SapphireTypes} from "../sapphire/SapphireTypes.sol";

contract PassportScoreVerifiableTest is PassportScoreVerifiable {

    event DidSomethingAndProofPassed();
    event DidSomethingOptionalProof();

    constructor(
        address _passportScoresContract
    )
        public
    {
        passportScoresContract = ISapphirePassportScores(_passportScoresContract);
    }

    function proofRequiredDoSomething(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, true, true)
    {
        emit DidSomethingAndProofPassed();
    }

    function proofOptionalDoSomething(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false, true)
    {
        emit DidSomethingOptionalProof();
    }
}
