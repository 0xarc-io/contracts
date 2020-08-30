pragma solidity ^0.5.16;

contract KYF {

    address public verifier;

    address public owner;

    uint256 public count;

    mapping (address => bool) public isVerified;

    event Verified (address _user, address _verified);
    event Removed (address _user);

    constructor() public {
        owner = msg.sender;
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
        bytes32 sigHash = keccak256(abi.encodePacked(
            _user
        ));

        bytes32 recoveryHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", sigHash)
        );

        address recoveredAddress = ecrecover(recoveryHash, _v, _r, _s);

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
            count--;
        }
    }

    function remove(
        address _user
    )
        public
    {
        require (
            msg.sender == owner,
            "Only callable by owner"
        );

        delete isVerified[_user];

        emit Removed(_user);
    }

    function setVerifier(
        address _verifier
    )
        public
    {
        require(
            msg.sender == owner,
            "Only callable by owner"
        );

        verifier = _verifier;
    }

}