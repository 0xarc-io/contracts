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
		'debt/spritz/CoreV1.sol',
		'debt/spritz/CoreV2.sol',
		'debt/mozart/MozartCoreV1.sol',
		'debt/mozart/savings/MozartSavingsV1.sol',
		'staking/AdminRewards.sol',
	],
	providerOptions: {
		default_balance_ether: 100000,
		gasLimit: 9007199254740991,
	},
};
