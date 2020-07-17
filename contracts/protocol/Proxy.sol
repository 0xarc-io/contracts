pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {AdminStorage} from "./Storage.sol";

contract Proxy is AdminStorage {

    constructor() public {
        // Set admin to caller
        admin = msg.sender;
    }

    /*** Admin Functions ***/
    function setPendingImplementation(
        address newPendingImplementation
    )
        public
        returns (uint)
    {

        require(
            msg.sender == admin,
            "Proxy.setPendingImplementation(): can only be set by admin"
        );

        address oldPendingImplementation = pendingCoreImplementation;

        pendingCoreImplementation = newPendingImplementation;

        emit NewPendingImplementation(
            oldPendingImplementation,
            pendingCoreImplementation
        );
    }

    /**
    * @notice Accepts new implementation of comptroller. msg.sender must be pendingImplementation
    * @dev Admin function for new implementation to accept it's role as implementation
    * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
    */
    function acceptImplementation() public returns (uint) {

        // Check caller is pendingImplementation and pendingImplementation ≠ address(0)
        require(
            msg.sender == pendingCoreImplementation || pendingCoreImplementation != address(0),
            "Proxy.acceptImplementation: must set a valid implementation"
        );

        // Save current values for inclusion in log
        address oldImplementation = coreImplementation;
        address oldPendingImplementation = pendingCoreImplementation;

        coreImplementation = pendingCoreImplementation;

        pendingCoreImplementation = address(0);

        emit NewImplementation(
            oldImplementation,
            coreImplementation
        );

        emit NewPendingImplementation(
            oldPendingImplementation,
            pendingCoreImplementation
        );
    }


    /**
      * @notice Begins transfer of admin rights. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.
      * @dev Admin function to begin change of admin. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.
      * @param newPendingAdmin New pending admin.
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function setPendingAdmin(address newPendingAdmin) public returns (uint) {

        // Check caller = admin
        require(
            msg.sender == admin,
            "Proxy.setPendingAdmin(): can only be set by the admin"
        );

        // Save current value, if any, for inclusion in log
        address oldPendingAdmin = pendingAdmin;

        // Store pendingAdmin with value newPendingAdmin
        pendingAdmin = newPendingAdmin;

        // Emit NewPendingAdmin(oldPendingAdmin, newPendingAdmin)
        emit NewPendingAdmin(
            oldPendingAdmin,
            newPendingAdmin
        );
    }

    /**
      * @notice Accepts transfer of admin rights. msg.sender must be pendingAdmin
      * @dev Admin function for pending admin to accept role and update admin
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function acceptAdmin() public returns (uint) {

        // Check caller is pendingAdmin and pendingAdmin ≠ address(0)
        require(
            msg.sender == pendingAdmin || msg.sender != address(0),
            "Proxy.acceptAdmin(): must be accepted by the new admin"
        );

        // Save current values for inclusion in log
        address oldAdmin = admin;
        address oldPendingAdmin = pendingAdmin;

        // Store admin with value pendingAdmin
        admin = pendingAdmin;

        // Clear the pending value
        pendingAdmin = address(0);

        emit NewAdmin(oldAdmin, admin);
        emit NewPendingAdmin(oldPendingAdmin, pendingAdmin);
    }

    /**
     * @dev Delegates execution to an implementation contract.
     * It returns to the external caller whatever the implementation returns
     * or forwards reverts.
     */
    function () payable external {
        // delegate all other functions to current implementation
        (bool success, ) = coreImplementation.delegatecall(msg.data);

        assembly {
              let free_mem_ptr := mload(0x40)
              returndatacopy(free_mem_ptr, 0, returndatasize)

              switch success
              case 0 { revert(free_mem_ptr, returndatasize) }
              default { return(free_mem_ptr, returndatasize) }
        }
    }
}