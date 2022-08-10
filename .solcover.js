module.exports = {
	skipFiles: [
		'interfaces',
		'test',
		'ArcProxy.sol',
		'ArcProxyInfo.sol',
		'token/ArcxToken.sol',
		'token/Permittable.sol',
	],
	providerOptions: {
		default_balance_ether: 100000,
		gasLimit: 9007199254740991,
	},
};
