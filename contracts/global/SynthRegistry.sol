pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

contract SynthRegistry is Ownable {

    struct Synth {
        bytes32 symbolKey;
        address proxyAddress;
        address syntheticAddress;
    }

    // Available Synths which can be used with the system
    address[] public availableSynths;

    mapping(bytes32 => address) public synths;

    mapping(address => Synth) public synthsByAddress;

    /* ========== EVENTS ========== */

    event SynthAdded(bytes32 currencyKey, address synth);
    event SynthRemoved(bytes32 currencyKey, address synth);


    /* ========== VIEW FUNCTIONS ========== */

    function getAllSynths()
        public
        view
        returns (address[] memory)
    {
        return availableSynths;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function addSynth(
        address proxy,
        address synth
    )
        external
        onlyOwner
    {
        bytes32 symbolKey = ISyntheticToken(synth).symbolKey();

        require(
            synths[symbolKey] == address(0),
            "Synth already exists"
        );

        require(
            synthsByAddress[address(synth)].symbolKey == bytes32(0),
            "Synth address already exists"
        );

        availableSynths.push(synth);
        synths[symbolKey] = synth;
        synthsByAddress[address(synth)] = Synth({
            symbolKey: symbolKey,
            proxyAddress: proxy,
            syntheticAddress: synth
        });

        emit SynthAdded(symbolKey, address(synth));
    }

    function removeSynth(
        bytes32 symbolKey
    )
        external
        onlyOwner
    {
        require(
            address(synths[symbolKey]) != address(0),
            "Synth does not exist"
        );

        require(
            IERC20(address(synths[symbolKey])).totalSupply() == 0,
            "Synth supply exists"
        );

        // Save the address we're removing for emitting the event at the end.
        address synthToRemove = address(synths[symbolKey]);

        // Remove the synth from the availableSynths array.
        for (uint i = 0; i < availableSynths.length; i++) {
            if (address(availableSynths[i]) == synthToRemove) {
                delete availableSynths[i];

                // Copy the last synth into the place of the one we just deleted
                // If there's only one synth, this is synths[0] = synths[0].
                // If we're deleting the last one, it's also a NOOP in the same way.
                availableSynths[i] = availableSynths[availableSynths.length - 1];

                // Decrease the size of the array by one.
                availableSynths.length--;

                break;
            }
        }

        // And remove it from the synths mapping
        delete synthsByAddress[address(synths[symbolKey])];
        delete synths[symbolKey];

        emit SynthRemoved(symbolKey, synthToRemove);
    }
}
