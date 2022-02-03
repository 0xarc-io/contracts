// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface ISapphirePool {
    /* ========== Mutating Functions ========== */

    function setCoreSwapLimit(address _coreAddress, uint256 _limit) external;

    function setDepositLimit(address _tokenAddress, uint256 _limit) external;

    function swap(
        address _tokenIn, 
        address _tokenOut, 
        uint256 _amountIn
    ) external;

    function deposit(address _token, uint256 _amount) external;

    function withdraw(uint256 _amount, address _outToken) external;

    /* ========== View Functions ========== */

    function getTokenUtilization(address _tokenAddress) external view returns (uint256, uint256);

    function accumulatedRewardAmount(address _token, address _user) external view returns (uint256);

    function coreSwapUtilization(address _coreAddress) external view returns (uint256, uint256);

    function assetsUtilization(address _tokenAddress) external view returns (uint256, uint256);

    function getDepositAssets() external view returns (address[] memory);
}
