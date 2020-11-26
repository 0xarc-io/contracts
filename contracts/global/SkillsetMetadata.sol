// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "../token/IERC20.sol";

import {Adminable} from "../lib/Adminable.sol";

contract SkillsetMetadataStorageV1 {

    mapping (address => bool) public approvedSkillsets;

    address[] public skillsetsArray;

    mapping (address => uint256) public maxLevel;

}

contract SkillsetMetadata is Adminable, SkillsetMetadataStorageV1 {

    /* ========== Events ========== */

    event SkillsetStatusUpdated(address _token, bool _status);
    event SkillsetMaxLevelSet(address _token, uint256 _level);

    /* ========== View Functions ========== */

    function getSkillsetBalance(
        address _token,
        address _user
    )
        public
        view
        returns (uint256)
    {
        return IERC20(_token).balanceOf(_user);
    }

    function isValidSkillset(
        address _token
    )
        public
        view
        returns (bool)
    {
        return approvedSkillsets[_token];
    }

    function getAllSkillsets()
        public
        view
        returns (address[] memory)
    {
        return skillsetsArray;
    }

    /* ========== Admin Functions ========== */

    function addSkillsetToken(
        address _token
    )
        public
        onlyAdmin
    {
        require(
            approvedSkillsets[_token] != true,
            "Skillset has already been added"
        );

        skillsetsArray.push(_token);
        approvedSkillsets[_token] = true;

        emit SkillsetStatusUpdated(_token, true);
    }

    function removeSkillsetToken(
        address _token
    )
        public
        onlyAdmin
    {
        require(
            approvedSkillsets[_token] == true,
            "Skillset does not exist"
        );

        for (uint i = 0; i < skillsetsArray.length; i++) {
            if (skillsetsArray[i] == _token) {
                delete skillsetsArray[i];
                skillsetsArray[i] = skillsetsArray[skillsetsArray.length - 1];
                skillsetsArray.length--;
                break;
            }
        }

        delete approvedSkillsets[_token];

        emit SkillsetStatusUpdated(_token, false);
    }

    function setMaxLevel(
        address _token,
        uint256 _level
    )
        public
        onlyAdmin
    {
        maxLevel[_token] = _level;

        emit SkillsetMaxLevelSet(_token, _level);

    }

}
