// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {Counters} from "@openzeppelin/contracts/drafts/Counters.sol";
import {ISapphireCreditScore} from "../../debt/sapphire/ISapphireCreditScore.sol";

contract DefiPassportStorage {

    /* ========== Public Variables ========== */

    string public name;
    string public symbol;

    /**
     * @notice The credit score contract used by the passport
     */
    ISapphireCreditScore public creditScoreContract;

    /**
     * @notice Records the approved skins of the passport
     */
    mapping (address => bool) public approvedSkins;
    
    /* ========== Private Variables ========== */

    Counters.Counter internal _tokenIds;

}
