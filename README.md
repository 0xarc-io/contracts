# ARC

Hello! This Readme will be updated soon but for now here's a rundown of the contracts.

## Contracts

### Synthetic Contracts

Each ARC pool is meant to be an indvidual pool containing two assets, a collateral asset and a synthetic.
In most places of the codebase, the synthetic is assumed to be a synthetic dollar but it doesn't have to be in practice.

When thinking about a synthetic pool you have the following contracts:

1. Proxy - a standard proxy where the implementation can be changed at will. Only fees are held by the proxy.
2. Core - the implementation logic of the proxy that will manipulate state.
3. State - containing state about the actual pool itself.
4. Synthetic Token - the actual synthetic asset which is minted. All collateral is stored inside here.

Users can only interact with the `operateAction` function inside `CoreV1`. That is the main way the state machine can be modified.
Each time the function is called it will ensure that the position that was modified is collateralised and the system is within it's limits at the moment.


### Staking Contracts

The second component of the ARC contracts are the Staking contracts which will be used to actually distribute the tokens. ARC tokens will need to be earned by users of the protocol itself. The main contracts are outlined here and their functions.

The idea here is that users can earn ARC tokens in two ways:

1. Deposit LINK -> ARC -> Get LINKUSD -> Deposit LINKUSD and USDC to Balancer -> Get BPT -> Stake BPT inside StakingRewardFees -> Earn ARC + BAL
2. Depsoit ARC + DAI to Balancer -> Get BPT -> Stake BPT inside StakingRewardFees -> Earn ARC + BAL

Here's the breakdown of the contracts themselves:

1. StakingRewards - this is copied directly from Synthetix and basically allows a rewarder to send reward tokens inside the contract and allow users to deposit staking tokens in order to slowly earn the reward tokens. The main modification here is that 1/3 of the tokens earned by users go to the ARCDAO.

2. TokenAccrual - a wrapper inspired from YFI contracts which allows you to claim a portion of any tokens that enter inside the contract

3. StakingRewardFees - this inherits from both and is used for users who staked BPT tokens to earn the equivalent value in another token by the user withdrawing the excess from the Staking Rewards, converting them and selling them back.

4. Distribution - this is how ARCDAO users can claim a portion of the fees earned. This contract will have the shares set by the owner only.

