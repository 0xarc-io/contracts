// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

pragma experimental ABIEncoderV2;

// KP3R.isKeeper(msg.sender)
// worked(msg.sender)

contract MockKeep3rV1 {
    /// @notice Worked a job
    event KeeperWorked(address indexed credit, address indexed job, address indexed keeper, uint block, uint amount);

    mapping(address => bool) keepers;

    function worked(address keeper) external {
        emit KeeperWorked(address(this), msg.sender, keeper, block.number, 10**18);
    }

    function activate() external {
        keepers[msg.sender] = true;
    }

    function isKeeper(address _keeper) external view returns (bool) {
        return keepers[_keeper];
    }
}
