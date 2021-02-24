// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../../lib/Ownable.sol";
import {SapphireTypes} from "./SapphireTypes.sol";
import {ISapphireCreditScore} from "./ISapphireCreditScore.sol";

contract SapphireCreditScore is ISapphireCreditScore, Ownable {
  /* ========== Structs ========== */

    struct CreditScore {
        uint256 score;
        uint256 lastUpdated;
    }

    /* ========== Variables ========== */

    bool public isPaused;

    uint256 public lastMerkleRootUpdate;

    uint256 public merkleRootDelayDuration;

    bytes32 public currentMerkleRoot;

    bytes32 public upcomingMerkleRoot;

    address public merkleRootUpdater;

    mapping(address => CreditScore) public userScores;

    /* ========== Modifiers ========== */

    modifier isAuthorized() {
        require(
            merkleRootUpdater == msg.sender,
            "SapphireCreditScore: caller is not authorized to update merkle root"
        );
        _;
    }

    modifier isAuthorizedOrOwner() {
        require(
            merkleRootUpdater == msg.sender || owner() == msg.sender,
            "SapphireCreditScore: caller is not authorized to update merkle root"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor(address _merkleRootUpdater) public {
        merkleRootUpdater = _merkleRootUpdater;
        lastMerkleRootUpdate = block.timestamp;
        isPaused = true;
    }

  /* ========== Functions ========== */

    function updateMerkleRoot(bytes32 newRoot) public isAuthorizedOrOwner {
        if (msg.sender == merkleRootUpdater) {
            // If admin calls update merkle root
            // - Replace upcoming merkle root (avoid time delay)
            // - Keep existing merkle root as-is
        } else {
            updateMerkleRootAsOwner(newRoot);
        }
    }

    function updateMerkleRootAsOwner(bytes32 newRoot) private onlyOwner {
        // If not admin
        // - Ensure duration has been passed
        // - Set the upcoming merkle root to the current one
        // - Set the passed in merkle root to the upcoming one
        require(
            isPaused == true,
            "SapphireCreditScore: pause contract to update merkle root as owner"
        );
        currentMerkleRoot = newRoot;
    }


    function request(SapphireTypes.ScoreProof memory proof) public returns (uint256) {
        // Decode the score from the current merkle root
        // Update the userScores mapping
        // Return the score
    }

    function getLastScore(address user) public returns (uint256, uint256) {}

    function setMerkleRootDelay(uint256 delay) public {}

    function setPause(bool status) public onlyOwner {
        isPaused = status;
    }
}
