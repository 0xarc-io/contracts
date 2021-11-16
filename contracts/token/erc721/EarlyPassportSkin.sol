// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {IERC721} from "../../.openzeppelin/4.x/token/ERC721/IERC721.sol";
import {ERC721} from "../../.openzeppelin/4.x/token/ERC721/ERC721.sol";
import {Ownable} from "../../lib/Ownable.sol";
import {Counters} from "../../.openzeppelin/4.x/utils/Counters.sol";

contract EarlyPassportSkin is ERC721, Ownable {
    using Counters for Counters.Counter;

    /* ========== Events ========== */

    event BaseURISet(string _uri);

    event PassportIDThresholdSet(uint256 _threshold);

    /* ========== Variables ========== */

    Counters.Counter private _tokenIdCounter;

    string public baseURI;

    uint256 public passportIdThreshold;

    IERC721 public defiPassport;

    /* ========== Constructor ========== */

    constructor(
        address _defiPassport
    ) 
        ERC721("EarlyPassportSkin", "EPS") 
    {
        defiPassport = IERC721(_defiPassport);
    }


    /* ========== Restricted functions ========== */

    function setBaseURI (string memory _uri) 
        external
        onlyOwner
    {
        baseURI = _uri;
        emit BaseURISet(_uri);
    }

    function setPassportIdThreshold (uint256 _threshold) 
        external
        onlyOwner
    {
        passportIdThreshold = _threshold;

        emit PassportIDThresholdSet(_threshold);
    }
    
    /* ========== Public functions ========== */

    function safeMint(address to) 
        public 
    {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }
}
