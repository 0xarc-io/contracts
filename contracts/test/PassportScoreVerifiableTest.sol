// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {PassportScoreVerifiable} from "../lib/PassportScoreVerifiable.sol";
import {ISapphirePassportScores} from "../sapphire/ISapphirePassportScores.sol";
import {SapphireTypes} from "../sapphire/SapphireTypes.sol";

contract PassportScoreVerifiableTest is PassportScoreVerifiable {

    event DidNotRevert();

    constructor(
        address _passportScoresContract
    )
        public
    {
        passportScoresContract = ISapphirePassportScores(_passportScoresContract);
    }

    function doSomething(
        SapphireTypes.ScoreProof memory _scoreProof,
        bool _mandatoryProof,
        bool _enforceSameCaller
    )
        public
        checkScoreProof(_scoreProof, _mandatoryProof, _enforceSameCaller)
    {
        emit DidNotRevert();
    }
}
