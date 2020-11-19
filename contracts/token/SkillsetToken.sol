// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract SkillsetToken is BaseERC20, Ownable {

    // ============ Variables ============

    address[] public mintersArray;

    mapping(address => bool) public minters;

    /* ========== EVENTS ========== */

    event MinterAdded(address _minter);
    event MinterRemoved(address _minter);

    // ============ Modifier ============

    modifier onlyMinter() {
        require(
            minters[msg.sender] == true,
            "Skillset: only callable by minter"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol
    )
        public
        BaseERC20(_name, _symbol, 18)
    { }

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

    // ============ Admin Functions ============

    function addMinter(
        address _minter
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

        emit MinterAdded(_minter);
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

        emit MinterRemoved(_minter);
    }

    // ============ Minter Functions ============

    function mint(
        address to,
        uint256 value
    )
        external
        onlyMinter
    {
        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        external
        onlyMinter
    {
        _burn(to, value);
    }

}
