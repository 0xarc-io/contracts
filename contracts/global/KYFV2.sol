// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {Ownable} from "../lib/Ownable.sol";
import {IKYFV2} from "../interfaces/IKYFV2.sol";

contract KYFV2 is Ownable, IKYFV2 {

    address public verifier;

    uint256 public count;

    uint256 public hardCap;

    mapping (address => bool) public isVerified;

    event Verified (address _user, address _verified);
    event Removed (address _user);
    event VerifierSet (address _verifier);
    event HardCapSet (uint256 _hardCap);

    function checkVerified(
        address _user
    )
        external
        view
        returns (bool)
    {
        return isVerified[_user];
    }

    function verify(
        address _user,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        returns (bool)
    {
        require(
            count < hardCap,
            "Hard cap reached"
        );

        require(
            isVerified[_user] == false,
            "User has already been verified"
        );

        bytes32 sigHash = keccak256(
            abi.encodePacked(
                _user
            )
        );

        bytes32 recoveryHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", sigHash)
        );

        address recoveredAddress = ecrecover(
            recoveryHash,
            _v,
            _r,
            _s
        );

        require(
            recoveredAddress == verifier,
            "Invalid signature"
        );

        isVerified[_user] = true;

        count++;

        emit Verified(_user, verifier);
    }

    function removeMultiple(
        address[] memory _users
    )
        public
    {
        for (uint256 i = 0; i < _users.length; i++) {
            remove(_users[i]);
        }
    }

    function remove(
        address _user
    )
        public
        onlyOwner
    {
        delete isVerified[_user];
        count--;

        emit Removed(_user);
    }

    function setVerifier(
        address _verifier
    )
        public
        onlyOwner
    {
        verifier = _verifier;
        emit VerifierSet(_verifier);
    }

    function setHardCap(
        uint256 _hardCap
    )
        public
        onlyOwner
    {
        hardCap = _hardCap;
        emit HardCapSet(_hardCap);
    }

}
