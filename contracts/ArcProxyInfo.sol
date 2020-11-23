// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

contract ArcProxyInfo {

    function getProxyImplementation(address proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("implementation()")) == 0x5c60da1b
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"5c60da1b");
        require(success, "getProxyImplementation(): call failed");
        return abi.decode(returndata, (address));
    }

    /**
    * @dev Returns the admin of a proxy. Only the admin can query it.
    * @return The address of the current admin of the proxy.
    */
    function getProxyAdmin(address proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("admin()")) == 0xf851a440
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"f851a440");
        require(success, "getProxyAdmin(): call failed");
        return abi.decode(returndata, (address));
    }

}
