// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {Adminable} from "../lib/Adminable.sol";
import {Initializable} from "../lib/Initializable.sol";
import {Address} from "../lib/Address.sol";

import {BaseERC20} from "../token/BaseERC20.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";

/**
 * @notice An ERC20 that allows users to deposit a given token, where their
 *         balance is expressed in forms of shares. This will expose users to the
 *         increase and decrease of the balance of the token on the contract.
 *
 *         To withdraw their balance, users must first express their withdrawal
 *         intent, which will trigger a cooldown after which they will be able
 *         to reclaim their share.
 */
contract StakingAccrualERC20 is BaseERC20, Adminable, Initializable {

    /* ========== Libraries ========== */

    using Address for address;

    /* ========== Variables ========== */

    uint8 private _decimals;

    IPermittableERC20 public stakingToken;

    /**
     * @notice Cooldown duration to be elapsed for users to exit
     */
    uint256 public exitCooldownDuration;

    /* ========== Constructor (ignore) ========== */

    constructor ()
        public
        BaseERC20("", "", 18)
    {}

    /* ========== Restricted Functions ========== */

    function init(
        string calldata __name,
        string calldata __symbol,
        uint8 __decimals,
        address _stakingToken,
        uint256 _exitCooldownDuration
    )
        external
        onlyAdmin
        initializer
    {
        _name = __name;
        _symbol = __symbol;
        _decimals = __decimals;
        exitCooldownDuration = _exitCooldownDuration;

        require (
            _stakingToken.isContract(),
            "StakingAccrualERC20: staking token is not a contract"
        );

        stakingToken = IPermittableERC20(_stakingToken);
    }

    // TODO: add stakeWithPermit()
}
