// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;


import {Adminable} from "../../lib/Adminable.sol";
import {InitializablePermittable} from "../../lib/InitializablePermittable.sol";
import {InitializableBaseERC20} from "../../token/InitializableBaseERC20.sol";

import {CredsStorage} from "./CredsStorage.sol";

contract CredsERC20 is Adminable, InitializableBaseERC20, CredsStorage {

    /* ========== Events ========== */

    event MinterAdded(address _minter, uint256 _limit);

    event MinterRemoved(address _minter);

    event MinterLimitUpdated(address _minter, uint256 _limit);

    event Initialized(
        string name,
        string symbol
    );

    /* ========== Modifiers ========== */

    modifier onlyMinter() {
        require(
            minterLimits[msg.sender] > 0,
            "CredsERC20: only callable by minter"
        );
        _;
    }

    /* ========== Init Function ========== */

/**
     * @dev Initialize the contract
     *
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     */
    function init(
        string memory _name,
        string memory _symbol
    )
        public
        onlyAdmin
        initializer
    {
        _init(_name, _symbol, 18);

        emit Initialized(
            _name,
            _symbol
        );
    }

    /* ========== View Functions ========== */

    function getAllMinters()
        external
        view
        returns (address[] memory)
    {
        return _mintersArray;
    }

    function isValidMinter(
        address _minter
    )
        external
        view
        returns (bool)
    {
        return minterLimits[_minter] > 0;
    }

    /* ========== Admin Functions ========== */

    /**
     * @dev Add a new valid minter.
     *
     * @param _minter The address of the minter to add
     * @param _limit The starting limit for how much the minter can mint
     */
    function addMinter(
        address _minter,
        uint256 _limit
    )
        external
        onlyAdmin
    {
        require(
            minterLimits[_minter] > 0,
            "CredsERC20: Minter already exists"
        );

        _mintersArray.push(_minter);
        minterLimits[_minter] = _limit;

        emit MinterAdded(_minter, _limit);
    }

    /**
     * @dev Remove a minter from the list of valid minters (thus setting its limit to 0)
     *
     * @param _minter Address of the minter to remove
     */
    function removeMinter(
        address _minter
    )
        external
        onlyAdmin
    {
        require(
            minterLimits[_minter] > 0,
            "CredsERC20: not a minter"
        );

        for (uint256 i = 0; i < _mintersArray.length; i++) {
            if (_mintersArray[i] == _minter) {
                _mintersArray[i] = _mintersArray[_mintersArray.length - 1];
                _mintersArray.pop();
                break;
            }
        }

        delete minterLimits[_minter];

        emit MinterRemoved(_minter);
    }

    /**
     * @dev Update the limit of the minter
     *
     * @param _minter The address of the minter to set
     * @param _limit The new limit to set for this address
     */
    function updateMinterLimit(
        address _minter,
        uint256 _limit
    )
        public
        onlyAdmin
    {
        require(
            minterLimits[_minter] > 0,
            "CredsERC20: not a minter"
        );

        require(
            minterLimits[_minter] != _limit,
            "CredsERC20: cannot set the same limit"
        );

        minterLimits[_minter] = _limit;

        emit MinterLimitUpdated(_minter, _limit);
    }

    /* ========== Minter Functions ========== */

    /**
     * @dev Mint tokens
     *
     * @notice Can only be called by a valid minter.
     *
     * @param _to The destination to mint the token to
     * @param _value The amount of tokens to mint
     */
    function mint(
        address _to,
        uint256 _value
    )
        external
        onlyMinter
    {
        require(
            _value > 0,
            "CredsERC20: cannot mint zero"
        );

        uint256 issuedAmount = minterIssued[msg.sender] + _value;

        require(
            issuedAmount <= minterLimits[msg.sender],
            "CredsERC20: minter limit reached"
        );

        minterIssued[msg.sender] = issuedAmount;

        _mint(_to, _value);
    }

    /**
     * @dev Burn tokens of the caller
     *
     * @param _value The amount of tokens to burn
     */
    function burn(
        uint256 _value
    )
        external
    {
        _burn(msg.sender, _value);
    }
}
