// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

import {Ownable} from "../lib/Ownable.sol";
import {Amount} from "../lib/Amount.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract SyntheticToken is BaseERC20, ISyntheticToken, Ownable {

    using Amount for Amount.Principal;

    // ============ Variables ============

    bytes32 private _symbolKey;

    uint8 private _version;

    address[] public mintersArray;

    mapping(address => bool) public minters;

    mapping(address => uint256) public _minterLimits;

    mapping(address => Amount.Principal) public _minterIssued;

    /* ========== EVENTS ========== */

    event MinterAdded(address _minter, uint256 _limit);

    event MinterRemoved(address _minter);

    event MinterLimitUpdated(address _minter, uint256 _limit);

    event MetadataChanged();

    // ============ Modifier ============

    modifier onlyMinter() {
        require(
            minters[msg.sender] == true,
            "SyntheticToken: only callable by minter"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 __version
    )
        public
        BaseERC20(_name, _symbol)
    {
        _version = __version;
        _symbolKey = keccak256(
            abi.encode(_symbol, _version)
        );
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getAllMinters()
        external
        view
        returns (address[] memory)
    {
        return mintersArray;
    }

    function isValidMinter(
        address _minter
    )
        external
        view
        returns (bool)
    {
        return minters[_minter];
    }

    function getMinterIssued(
        address _minter
    )
        external
        view
        returns (Amount.Principal memory)
    {
        return _minterIssued[_minter];
    }

    function getMinterLimit(
        address _minter
    )
        external
        view
        returns (uint256)
    {
        return _minterLimits[_minter];
    }

    function symbolKey()
        external
        view
        returns (bytes32)
    {
        return _symbolKey;
    }

    function version()
        external
        view
        returns (uint8)
    {
        return _version;
    }

    // ============ Admin Functions ============

    function updateMetadata(
        string calldata __name,
        string calldata __symbol
    )
        external
        onlyOwner
    {
        _name = __name;
        _symbol = __symbol;
        emit MetadataChanged();
    }

    function addMinter(
        address _minter,
        uint256 _limit
    )
        external
        onlyOwner
    {
        require(
            minters[_minter] != true,
            "Minter already exists"
        );

        mintersArray.push(_minter);
        minters[_minter] = true;
        _minterLimits[_minter] = _limit;

        emit MinterAdded(_minter, _limit);
    }

    function removeMinter(
        address _minter
    )
        external
        onlyOwner
    {
        require(
            minters[_minter] == true,
            "Minter does not exist"
        );


        // Remove the synth from the availableSynths array.
        for (uint i = 0; i < mintersArray.length; i++) {
            if (address(mintersArray[i]) == _minter) {
                delete mintersArray[i];

                // Copy the last synth into the place of the one we just deleted
                // If there's only one synth, this is synths[0] = synths[0].
                // If we're deleting the last one, it's also a NOOP in the same way.
                mintersArray[i] = mintersArray[mintersArray.length - 1];

                // Decrease the size of the array by one.
                mintersArray.length--;

                break;
            }
        }

        // And remove it from the minters mapping
        delete minters[_minter];
        delete _minterLimits[_minter];

        emit MinterRemoved(_minter);
    }

    function updateMinterLimit(
        address _minter,
        uint256 _limit
    )
        public
        onlyOwner
    {
        require(
            minters[_minter] == true,
            "Minter does not exist"
        );

        _minterLimits[_minter] = _limit;

        emit MinterLimitUpdated(_minter, _limit);
    }

    // ============ Minter Functions ============

    function mint(
        address to,
        uint256 value
    )
        external
        onlyMinter
    {
        Amount.Principal memory issuedAmount = _minterIssued[msg.sender].add(
            Amount.Principal({ sign: true, value: value })
        );

        require(
            issuedAmount.sign == false || issuedAmount.value <= _minterLimits[msg.sender],
            "Minter limit reached"
        );

        _minterIssued[msg.sender] = issuedAmount;
        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        external
        onlyMinter
    {
        _minterIssued[msg.sender] = _minterIssued[msg.sender].sub(
            Amount.Principal({ sign: true, value: value })
        );

        _burn(to, value);
    }

    function transferCollateral(
        address token,
        address to,
        uint256 value
    )
        external
        onlyMinter
        returns (bool)
    {
        return BaseERC20(token).transfer(
            to,
            value
        );
    }

}
