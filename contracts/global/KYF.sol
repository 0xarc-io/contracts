pragma solidity ^0.5.16;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";

contract KYF is Ownable {

    address public verifier;

    uint256 public count;

    mapping (address => bool) public isVerified;

    event Verified (address _user, address _verified);
    event Removed (address _user);
    event VerifierSet (address _verifier);

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

}