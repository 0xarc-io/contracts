// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import {Ownable} from "../lib/Ownable.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {SafeMath} from "../lib/SafeMath.sol";

import {IMintableToken} from "../token/IMintableToken.sol";
import {BaseERC20} from "./BaseERC20.sol";

contract ArcxTokenV2 is BaseERC20, IMintableToken, Ownable {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Variables ========== */

    uint8 public version;
    BaseERC20 public oldArcxToken;

    /* ========== Events ========== */

    event Claimed(
        address _owner,
        uint256 _amount
    );

    event OtherOwnershipTransfered(
        address _targetContract,
        address _newOwner
    );

    // ============ Constructor ============

    constructor(
        address _oldArcxToken
    )
        public
        BaseERC20("ARC Governance Token", "ARCX", 18)
    {
        require(
            _oldArcxToken != address(0),
            "ArcxTokenV2: old ARCX token cannot be address 0"
        );

        oldArcxToken = BaseERC20(_oldArcxToken);
        version = 2;
    }

    // ============ Core Functions ============

    function mint(
        address to,
        uint256 value
    )
        external
        onlyOwner
    {
        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        external
        onlyOwner
    {
        _burn(to, value);
    }

    // ============ Migration Function ============

    /**
     * @dev Transfers the old tokens to the owner and
     *      mints the new tokens, respecting a 1 : 10,000 ratio.
     *
     * @notice Convert the old tokens from the old ARCX token to the new (this one).
     */
    function claim()
        external
    {
        uint256 balance = oldArcxToken.balanceOf(msg.sender);
        uint256 newBalance = balance.mul(10000);

        require(
            balance > 0,
            "ArcxTokenV2: user has 0 balance of old tokens"
        );

        // Burn old balance

        // Transferring tokens to owner, because they can't be burned and can't
        // be sent to address 0;
        SafeERC20.safeTransferFrom(
            oldArcxToken,
            msg.sender,
            owner(),
            balance
        );

        // Mint new balance
        _mint(
            msg.sender,
            newBalance
        );

        emit Claimed(
            msg.sender,
            newBalance
        );
    }

    // ============ Owner Function ============

    function transferOtherOwnership(
        address _targetContract,
        address _newOwner
    )
        external
        onlyOwner
    {
        Ownable ownableContract = Ownable(_targetContract);

        require(
            ownableContract.owner() == address(this),
            "ArcxTokenV2: this contract is not the owner of the target"
        );

        ownableContract.transferOwnership(_newOwner);

        emit OtherOwnershipTransfered(
            _targetContract,
            _newOwner
        );
    }
}
