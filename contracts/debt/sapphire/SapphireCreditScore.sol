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

    /* ========== Events ========== */

    event MerkleRootUpdated(
        address updater,
        bytes32 merkleRoot,
        uint256 updatedAt
    );

    event CreditScoreUpdated(
        address account,
        uint256 score,
        uint256 lastUpdated,
        bytes32 merkleProof
    );

    event PauseStatusUpdated(bool value);

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

    modifier isActive() {
        require(
            isPaused == false,
            "SapphireCreditScore: contract is not active"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor(bytes32 merkleRoot, address _merkleRootUpdater) public {
        currentMerkleRoot = merkleRoot;
        upcomingMerkleRoot = merkleRoot;
        merkleRootUpdater = _merkleRootUpdater;
        lastMerkleRootUpdate = 0;
        isPaused = true;
        merkleRootDelayDuration = 86400; // 24 * 60 * 60 sec
    }

  /* ========== Functions ========== */

    function updateMerkleRoot(bytes32 newRoot) public isAuthorizedOrOwner {
        if (msg.sender == merkleRootUpdater) {
            updateMerkleRootAsUpdator(newRoot);
        } else {
            updateMerkleRootAsOwner(newRoot);
        }
    }

    function updateMerkleRootAsUpdator(bytes32 newRoot) private isAuthorized isActive {
        // If not admin
        // - Ensure duration has been passed
        // - Set the upcoming merkle root to the current one
        // - Set the passed in merkle root to the upcoming one
        require(
            block.timestamp - lastMerkleRootUpdate > merkleRootDelayDuration,
            "SapphireCreditScore: too frequent root update"
        );
        currentMerkleRoot = upcomingMerkleRoot;
        upcomingMerkleRoot = newRoot;
        lastMerkleRootUpdate = block.timestamp;
    }

    function updateMerkleRootAsOwner(bytes32 newRoot) private onlyOwner {
        // If admin calls update merkle root
        // - Replace upcoming merkle root (avoid time delay)
        // - Keep existing merkle root as-is
        require(
            isPaused == true,
            "SapphireCreditScore: pause contract to update merkle root as owner"
        );
        currentMerkleRoot = newRoot;
    }

    function request(SapphireTypes.ScoreProof memory proof) public view returns (uint256) {
        // abi.decode(proof, (data structure))
        // Decode the score from the current merkle root === verify

        // Update the userScores mapping
        // Return the score
        return proof.score;
    }

    function getLastScore(address user) public view returns (uint256, uint256) {
        return (1, 1);
    }

    function setMerkleRootDelay(uint256 delay) public {}

    function setPause(bool status) public onlyOwner {
        isPaused = status;
    }

    function updateMerkleRootUpdater(address merkleRootUpdator) public {}
}
