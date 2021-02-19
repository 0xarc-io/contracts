// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireCreditScore {

    /* ========== Structs ========== */

    struct CreditScore {
        uint256 score;
        uint256 lastUpdated;
    }

    /* ========== Variables ========== */

    bool public isPaused;

    uint256 public merkleRootDelayDuration;

    bytes32 public currentMerkleRoot;

    bytes32 public upcomingMerkleRoot;

    address public merkleRootUpdater;

    mapping (address => CreditScore) public userScores;

    /* ========== Functions ========== */

    function updateMerkleRoot(
        bytes32 newRoot
    )
        public
    {
        // Set the upcoming merkle root to the current one
        // Set the passed in merkle root to the upcoming one
    }

    function request(
        SapphireTypes.ScoreProof memory proof
    )
        public
        returns (uint256)
    {
        // Decode the score from the current merkle root
        // Update the userScores mapping
        // Return the score
    }

    function getLastScore(
        address user
    )
        returns (uint256, uint256)
    {

    }

    function setMerkleRootDelay(
        uint256 delay
    )
        public
    {

    }

    function setPause(
        bool status
    )
        public
    {

    }


}
