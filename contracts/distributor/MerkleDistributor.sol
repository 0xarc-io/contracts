// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "../lib/Ownable.sol";
import {IMerkleDistributor} from "./IMerkleDistributor.sol";


contract MerkleDistributor is IMerkleDistributor, Ownable {
    address public override token;
    bytes32 public override merkleRoot;
    bool public active;
    mapping(uint256 => uint256) private claimedBitMap;

    /* ========== Modifier ========== */

    modifier isActive() {
        require(active == true, "MerkleDistributor: Contract is not active");
        _;
    }

    constructor(address token_, bytes32 merkleRoot_) {
        token = token_;
        merkleRoot = merkleRoot_;
        active = false;
    }

    function switchActive() external onlyOwner {
        active = !active;
    }

    function isClaimed(uint256 index) public override view returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
    }

    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external override isActive {
        require(!isClaimed(index), "MerkleDistributor: Drop already claimed");

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "MerkleDistributor: Invalid proof");

        // Mark it claimed and send the token.
        _setClaimed(index);
        require(IERC20(token).transfer(account, amount), "MerkleDistributor: Transfer failed");

        emit Claimed(index, account, amount);
    }
}
