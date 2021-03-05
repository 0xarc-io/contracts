// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

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
        uint256 lastUpdated
    );

    event PauseStatusUpdated(bool value);

    event DelayDurationUpdated(
        address account,
        uint256 value
    );

    /* ========== Variables ========== */
    
    uint16 public maxScore;

    bool public isPaused;

    uint256 public lastMerkleRootUpdate;

    uint256 public merkleRootDelayDuration;

    bytes32 public currentMerkleRoot;

    bytes32 public upcomingMerkleRoot;

    address public merkleRootUpdater;

    mapping(address => CreditScore) public userScores;

    /* ========== Modifiers ========== */

    modifier isMerkleRootUpdater() {
        require(
            merkleRootUpdater == msg.sender,
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

    constructor(bytes32 merkleRoot, address _merkleRootUpdater, uint16 _maxScore) public {
        currentMerkleRoot = merkleRoot;
        upcomingMerkleRoot = merkleRoot;
        merkleRootUpdater = _merkleRootUpdater;
        lastMerkleRootUpdate = 0;
        isPaused = true;
        merkleRootDelayDuration = 86400; // 24 * 60 * 60 sec
        maxScore = _maxScore;
    }

  /* ========== Functions ========== */

    /**
     * @dev Returns current block's timestamp
     *
     * @notice This function is introduced in order to properly test time delays in this contract
     */
    function getCurrentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    /**
     * @dev Update upcoming merkle root
     * 
     * @notice Can be called by: 
     *      - the owner: 
                1. Check if contract is paused
                2. Replace uncoming merkle root
     *      - merkle root updater:
     *          1. Check if contract is active  
     *          2. Replace current merkle root with upcoming merkle root
     *          3. Update upcoming one with passed mekle root.
     *          4. Update the last merkle root update with the current timestamp
     *
     * @param newRoot New upcoming merkle root
     */
    function updateMerkleRoot(
        bytes32 newRoot
    )
    public
    {
        require(
            newRoot != 0x0000000000000000000000000000000000000000000000000000000000000000,
            "SapphireCreditScore: root is empty"
        );
        if (msg.sender == owner()) {
            updateMerkleRootAsOwner(newRoot);
        } else {
            updateMerkleRootAsUpdator(newRoot);
        }
        emit MerkleRootUpdated(msg.sender, newRoot, getCurrentTimestamp());
    }

    /**
     * @dev Merkle root updating strategy for merkle root updator
    **/
    function updateMerkleRootAsUpdator(
        bytes32 newRoot
    )
        private
        isMerkleRootUpdater
        isActive
    {
        require(
            getCurrentTimestamp() >= merkleRootDelayDuration + lastMerkleRootUpdate,
            "SapphireCreditScore: too frequent root update"
        );
        currentMerkleRoot = upcomingMerkleRoot;
        upcomingMerkleRoot = newRoot;
        lastMerkleRootUpdate = getCurrentTimestamp();
    }

    /**
     * @dev Merkle root updating strategy for the owner
    **/
    function updateMerkleRootAsOwner(
        bytes32 newRoot
    )
        private
        onlyOwner
    {
        require(
            isPaused == true,
            "SapphireCreditScore: pause contract to update merkle root as owner"
        );
        upcomingMerkleRoot = newRoot;
    }

   /**
     * @dev Request for verifying user's credit score
     * 
     * @notice If credit score is verified, this function updated user credit scores with verified one and current timestmp
     *
     * @param poof Data required to verify if score is correct for current merkle root
     */
    function request(
        SapphireTypes.ScoreProof memory proof
    )
        public
        returns (uint256)
    {
        bytes32 node = keccak256(abi.encodePacked(proof.account, proof.score));
        require(MerkleProof.verify(proof.merkleProof, currentMerkleRoot, node), "SapphireCreditScore: invalid proof");
        userScores[proof.account] = CreditScore({
            score: proof.score,
            lastUpdated: getCurrentTimestamp()
        });
        emit CreditScoreUpdated(proof.account, proof.score, getCurrentTimestamp());

        return proof.score;
    }

   /**
     * @dev Return last verified user score
     */
    function getLastScore(
        address user
    )
        public
        view
        returns (uint256, uint16, uint256)
    {
        CreditScore memory userScore = userScores[user];
        return (userScore.score, maxScore, userScore.lastUpdated);
    }


    /**
     * @dev Update merkle root delay durration
    */
    function setMerkleRootDelay(
        uint256 delay
    )
        public
        onlyOwner
    {
        merkleRootDelayDuration = delay;
        emit DelayDurationUpdated(msg.sender, delay);
    }

    /**
     * @dev Pause contract, which cause that merkle root updated is not able to update the merkle root
     */
    function setPause(
        bool value
    )
        public
        onlyOwner
    {
        isPaused = value;
        emit PauseStatusUpdated(value);
    }

    /**
     * @dev Update merkle root updater
    */
    function updateMerkleRootUpdater(
        address _merkleRootUpdator
    )
        public
        onlyOwner
    {
        merkleRootUpdater = _merkleRootUpdator;
    }
}
