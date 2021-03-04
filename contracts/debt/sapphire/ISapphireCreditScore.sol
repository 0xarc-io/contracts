// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SapphireTypes} from "./SapphireTypes.sol";

interface ISapphireCreditScore {
    function userScores(address _user) external view returns (SapphireTypes.CreditScore memory);
    
    function maxScore() external view returns(uint256);
    
    function updateMerkleRoot(bytes32 newRoot) external;
    
    function updateMerkleRootUpdater(address mercleRootUpdator) external;

    function request(SapphireTypes.ScoreProof calldata proof) external view returns (uint256);

    function getLastScore(address user) external view returns (uint256, uint256);

    function setMerkleRootDelay(uint256 delay) external;

    function setPause(bool status) external;
}
