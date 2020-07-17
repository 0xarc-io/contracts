pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {StateV1} from "./StateV1.sol";

contract AdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active implementation of the asset
    */
    address public coreImplementation;

    /**
    * @notice Pending implementation of asset
    */
    address public pendingCoreImplementation;

    /**
      * @notice Emitted when pendingCoreImplementation is changed
      */
    event NewPendingImplementation(
        address oldPendingImplementation,
        address newPendingImplementation
    );

    /**
      * @notice Emitted when pendingCoreImplementation is accepted,
      * which means comptroller implementation is updated
      */
    event NewImplementation(
        address oldImplementation,
        address newImplementation
    );

    /**
      * @notice Emitted when pendingAdmin is changed
      */
    event NewPendingAdmin(
        address oldPendingAdmin,
        address newPendingAdmin
    );

    /**
      * @notice Emitted when pendingAdmin is accepted, which means admin is updated
      */
    event NewAdmin(
        address oldAdmin,
        address newAdmin
    );
}

contract V1Storage {

    StateV1 public state;

}