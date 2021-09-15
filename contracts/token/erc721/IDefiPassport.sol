pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireTypes} from "../../sapphire/SapphireTypes.sol";

contract IDefiPassport {
    function mint(
        address _to,
        address _passportSkin,
        uint256 _skinTokenId,
        SapphireTypes.ScoreProof calldata _scoreProof
    )
        external
        returns (uint256);
}
