import ganache from 'ganache-core';
import { ethers } from 'ethers';

export class Ganache extends ethers.providers.Web3Provider {

    static DefaultOptions: ganache.IProviderOptions = {
        total_accounts: 20,
        gasLimit: 19000000,
        mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
        default_balance_ether: 10000000000
    }

    constructor(opts?: ganache.IProviderOptions) {
        const gp = ganache.provider(opts);
        super(gp as any);
    }
}

