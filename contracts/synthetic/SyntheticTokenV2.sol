// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IERC20} from "../token/IERC20.sol";

import {Adminable} from "../lib/Adminable.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {Amount} from "../lib/Amount.sol";
import {Permittable} from "../token/Permittable.sol";

import {SyntheticStorageV2} from "./SyntheticStorageV2.sol";

contract SyntheticTokenV2 is Adminable, SyntheticStorageV2, IERC20, Permittable {

    using SafeMath for uint256;
    using Amount for Amount.Principal;

    /* ========== Events ========== */

    event MinterAdded(address _minter, uint256 _limit);

    event MinterRemoved(address _minter);

    event MinterLimitUpdated(address _minter, uint256 _limit);

    event InitCalled(
        string name,
        string symbol,
        string version
    );

    /* ========== Modifiers ========== */

    modifier onlyMinter() {
        require(
            _minters[msg.sender] == true,
            "SyntheticTokenV2: only callable by minter"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor(
        string memory _name,
        string memory _version
    )
        Permittable(_name, _version)
        public
    { }

    /* ========== Init Function ========== */

/**
     * @dev Initialise the synthetic token
     *
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _version The version number of this token
     */
    function init(
        string memory _name,
        string memory _symbol,
        string memory _version
    )
        public
        onlyAdmin
    {
        require(
            _initCalled == false,
            "SyntheticTokenV2: cannot be initialized twice"
        );

        name = _name;
        symbol = _symbol;
        version = _version;

        DOMAIN_SEPARATOR = _initDomainSeparator(_name, _symbol);

        _initCalled = true;

        emit InitCalled(
            _name,
            _symbol,
            _version
        );
    }

    /* ========== View Functions ========== */

    function decimals()
        external
        pure
        returns (uint8)
    {
        return 18;
    }

    function totalSupply()
        external
        view
        returns (uint256)
    {
        return _totalSupply;
    }

    function balanceOf(
        address account
    )
        public
        view
        returns (uint256)
    {
        return _balances[account];
    }

    function allowance(
        address owner,
        address spender
    )
        public
        view
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

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
        return _minters[_minter];
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

    /* ========== Admin Functions ========== */

    /**
     * @dev Add a new minter to the synthetic token.
     *
     * @param _minter The address of the minter to add
     * @param _limit The starting limit for how much this synth can mint
     */
    function addMinter(
        address _minter,
        uint256 _limit
    )
        external
        onlyAdmin
    {
        require(
            _minters[_minter] != true,
            "SyntheticTokenV2: Minter already exists"
        );

        _mintersArray.push(_minter);
        _minters[_minter] = true;
        _minterLimits[_minter] = _limit;

        emit MinterAdded(_minter, _limit);
    }

    /**
     * @dev Remove a minter from the synthetic token
     *
     * @param _minter Address to remove the minter
     */
    function removeMinter(
        address _minter
    )
        external
        onlyAdmin
    {
        require(
            _minters[_minter] == true,
            "SyntheticTokenV2: minter does not exist"
        );

        for (uint256 i = 0; i < _mintersArray.length; i++) {
            if (address(_mintersArray[i]) == _minter) {
                _mintersArray[i] = _mintersArray[_mintersArray.length - 1];
                _mintersArray.length--;

                break;
            }
        }

        delete _minters[_minter];
        delete _minterLimits[_minter];

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
            _minters[_minter] == true,
            "SyntheticTokenV2: minter does not exist"
        );

        require(
            _minterLimits[_minter] != _limit,
            "SyntheticTokenV2: cannot set the same limit"
        );

        _minterLimits[_minter] = _limit;

        emit MinterLimitUpdated(_minter, _limit);
    }

    /* ========== Minter Functions ========== */

    /**
     * @dev Mint synthetic tokens
     *
     * @notice Can only be called by a valid minter.
     *
     * @param _to The destination  to mint the synth to
     * @param _value The amount of synths to mint
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
            "SyntheticTokenV2: cannot mint zero"
        );

        Amount.Principal memory issuedAmount = _minterIssued[msg.sender].add(
            Amount.Principal({ sign: true, value: _value })
        );

        require(
            issuedAmount.value <= _minterLimits[msg.sender] || issuedAmount.sign == false,
            "SyntheticTokenV2: minter limit reached"
        );

        _minterIssued[msg.sender] = issuedAmount;
        _mint(_to, _value);
    }

    /**
     * @dev Burn synthetic tokens of the msg.sender
     *
     * @param _value The amount of the synth to destroy
     */
    function burn(
        uint256 _value
    )
        external
    {
        _burn(_value);
    }

    /**
     * @dev Burn synthetic tokens of the minter. Same as `burn()` but
     *      only callable by the minter. Used to record amounts issued
     *
     * @notice Can only be called by a valid minter
     *
     * @param _value The amount of the synth to destroy
     */
    function destroy(
        uint256 _value
    )
        external
        onlyMinter
    {
        _minterIssued[msg.sender] = _minterIssued[msg.sender].sub(
            Amount.Principal({ sign: true, value: _value })
        );

        _burn(_value);
    }

    /* ========== ERC20 Mutative Functions ========== */

    function transfer(
        address recipient,
        uint256 amount
    )
        public
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev Allows `spender` to withdraw from msg.sender multiple times, up to the
     *      `amount`.
     *      Warning: It is recommended to first set the allowance to 0 before
     *      changing it, to prevent a double-spend exploit outlined below:
     *      https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     */
    function approve(
        address spender,
        uint256 amount
    )
        public
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    )
        public
        returns (bool)
    {
        require(
            _allowances[sender][msg.sender] >= amount,
            "SyntheticTokenv2: the amount has not been approved for this spender"
        );

        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowances[sender][msg.sender].sub(amount)
        );

        return true;
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over `owner`'s tokens,
     * assuming the latter's signed approval.
     *
     * IMPORTANT: The same issues Erc20 `approve` has related to transaction
     * ordering also apply here.
     * In addition, please be aware that:
     * - If an owner signs a permit with no deadline, the corresponding spender
     *   can call permit at any time in the future to mess with the nonce,
     *   invalidating signatures to other spenders, possibly making their transactions
     *   fail.
     * - Even if only permits with finite deadline are signed, to avoid the above
     *   scenario, an owner would have to wait for the conclusion of the deadline
     *   to sign a permit for another spender.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     *   over the Eip712-formatted function arguments.
     * - The signature must use `owner`'s current nonce.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
    {
        _permit(
            owner,
            spender,
            value,
            deadline,
            v,
            r,
            s
        );

        _approve(owner, spender, value);
    }

    /* ========== Internal Functions ========== */

    function _transfer(
        address _sender,
        address _recipient,
        uint256 _amount
    )
        internal
    {
        require(
            _sender != address(0),
            "SyntheticTokenV2: transfer from the zero address"
        );

        require(
            _recipient != address(0),
            "SyntheticTokenV2: transfer to the zero address"
        );

        require(
            _balances[_sender] >= _amount,
            "SyntheticTokenV2: sender does not have enough balance"
        );

        _balances[_sender]      = _balances[_sender].sub(_amount);
        _balances[_recipient]   = _balances[_recipient].add(_amount);

        emit Transfer(_sender, _recipient, _amount);
    }

    function _mint(
        address _account,
        uint256 _amount
    )
        internal
    {
        require(
            _account != address(0),
            "SyntheticTokenV2: cannot mint to the zero address"
        );

        _totalSupply = _totalSupply.add(_amount);

        _balances[_account] = _balances[_account].add(_amount);

        emit Transfer(address(0), _account, _amount);
    }

    function _burn(
        uint256 _value
    )
        internal
    {
        require(
            _balances[msg.sender] >= _value,
            "SyntheticTokenV2: cannot destroy more tokens than the balance"
        );

        _balances[msg.sender] = _balances[msg.sender].sub(_value);
        _totalSupply = _totalSupply.sub(_value);

        emit Transfer(msg.sender, address(0), _value);
    }

    function _approve(
        address _owner,
        address _spender,
        uint256 _amount
    )
        internal
    {
        require(
            _owner != address(0),
            "SyntheticTokenV2: approve from the zero address"
        );

        require(
            _spender != address(0),
            "SyntheticTokenV2: approve to the zero address"
        );

        _allowances[_owner][_spender] = _amount;

        emit Approval(_owner, _spender, _amount);
    }
}
