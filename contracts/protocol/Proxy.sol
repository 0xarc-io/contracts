// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

/* solium-disable-next-line */
import { AdminUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/AdminUpgradeabilityProxy.sol";

contract Proxy is
    AdminUpgradeabilityProxy
{
    /**
     * @dev The constructor of the proxy that sets the admin and logic.
     *
     * @param  logic  The address of the contract that implements the underlying logic.
     * @param  admin  The address of the admin of the proxy.
     * @param  data   Any data to send immediately to the implementation contract.
     */
    constructor(
        address logic,
        address admin,
        bytes memory data
    )
        public
        AdminUpgradeabilityProxy(
            logic,
            admin,
            data
        )
    {}

    /**
     * @dev Overrides the default functionality that prevents the admin from reaching the
     *  implementation contract.
     */
    function _willFallback()
        internal
    { /* solium-disable-line no-empty-blocks */ }
}