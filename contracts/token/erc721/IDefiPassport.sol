// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphireTypes} from "../../sapphire/SapphireTypes.sol";

abstract contract IDefiPassport {
    function mint(
        address _to,
        address _passportSkin,
        uint256 _skinTokenId,
        SapphireTypes.ScoreProof calldata _scoreProof
    )
        external
        virtual
        returns (uint256);
}
