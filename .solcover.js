module.exports = {
	skipFiles: [
		'interfaces',
		'test',
		'global',
		'oracle',
		'ArcProxy.sol',
		'ArcProxyInfo.sol',
		'token/ArcxToken.sol',
		'token/KYFToken.sol',
		'token/SkillsetToken.sol',
		'token/Permittable.sol',
		'staking/AdminRewards.sol',
	],
	providerOptions: {
		default_balance_ether: 100000,
		gasLimit: 9007199254740991,
	},
};
