pragma solidity 0.5.16;

import {ERC721Full} from "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import {Counters} from "@openzeppelin/contracts/drafts/Counters.sol";
import {Adminable} from "../../lib/Adminable.sol";

contract DefiPassport is ERC721Full, Adminable {

    /* ========== Libraries ========== */

    using Counters for Counters.Counter;

    /* ========== Public Variables ========== */

    string public name;
    string public symbol;

    /* ========== Private Variables ========== */

    Counters.Counter private _tokenIds;

    /* ========== Constructor ========== */

    constructor()
        ERC721Full("", "")
        public
    {}

    /* ========== Admin Setters ========== */

    function init(
        string calldata _name,
        string calldata _symbol
    )
        external
        onlyAdmin
    {
        name = _name;
        symbol = _symbol;

        /*
        *   register the supported interfaces to conform to ERC721 via ERC165
        *   bytes4(keccak256('name()')) == 0x06fdde03
        *   bytes4(keccak256('symbol()')) == 0x95d89b41
        *   bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
        *
        *   => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
        */
        _registerInterface(0x5b5e139f);
    }
}
