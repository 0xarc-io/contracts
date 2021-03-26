import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { BWBTCBadgerLPOracle, BWBTCBadgerLPOracleFactory } from '@src/typings';
import { expect } from 'chai';

const bSLPAddress = '0x1862A18181346EBd9EdAf800804f89190DeF24a5';
const bUNIV2Address = '0x235c9e24D3FB2FAFd58a2E49D454Fdcd2DBf7FF1';

/**
 * The oracles were made according to the following post:
 * https://blog.alphafinance.io/fair-lp-token-pricing/
 *
 * To see the math, check out the following Sheet:
 * https://docs.google.com/spreadsheets/d/19nDdvolghFO1Q9t5fUdukfF9qlhA0VeylCuGkFo9Haw/edit#gid=0
 */

describe('BWBTCBadgerLPOracle', () => {
  let oracle: BWBTCBadgerLPOracle;
  let signer;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12115818,
      },
    });
    signer = await provider.getSigner();
  });

  describe('bSLP (Sushi)', () => {
    before(async () => {
      oracle = await new BWBTCBadgerLPOracleFactory(signer).deploy(bSLPAddress);
    });

    it('should give the correct price', async () => {
      const price = await oracle.fetchCurrentPrice();

      expect(price.value).to.eq(BigNumber.from('381473966884915972882352318'));
    });
  });

  describe('bUNI-V2 - (Uniswap)', () => {
    before(async () => {
      oracle = await new BWBTCBadgerLPOracleFactory(signer).deploy(bUNIV2Address);
    });

    it('should give the correct price', async () => {
      const price = await oracle.fetchCurrentPrice();

      expect(price.value).to.eq(BigNumber.from('481683209528128164822464083'));
    });
  });
});
