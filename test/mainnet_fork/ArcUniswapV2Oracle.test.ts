import { ArcUniswapV2Oracle, ArcUniswapV2OracleFactory } from '@src/typings';
import { IKeep3rV1Factory } from '@src/typings/IKeep3rV1Factory';
import { ethers } from 'hardhat';
import { time } from '@openzeppelin/test-helpers';
import { BigNumber, Signer } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { setStartingBalances } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { Keep3rV1Factory } from '@src/typings/Keep3rV1Factory';
import { Keep3rV1OracleFactory } from '@src/typings/Keep3rV1OracleFactory';

const KEEP3RV1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
const UNIV2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const UNIV2_OFFICIAL_SLIDING_ORACLE = '0x73353801921417F465377c8d898c6f4C0270282C';
const DIGG = '0x798D1bE841a82a273720CE31c822C61a67a601C3';
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const KPR = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';

// Set window period to 10 minutes
const windowPeriodMinutes = 10;

describe('ArcUniswapV2Oracle', () => {
  let oracle: ArcUniswapV2Oracle;
  let owner: Signer;
  let keeper: Signer;
  let nonKeeper: Signer;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    keeper = signers[1];
    nonKeeper = signers[2];

    const keeperV1 = IKeep3rV1Factory.connect(KEEP3RV1_ADDRESS, keeper);
    // become keeper
    await keeperV1.bond(KPR, 0);
    // add 3 days to be able to activate as a keeper
    await time.increase(time.duration.days(3));
    await keeperV1.activate(KPR);

    oracle = await new ArcUniswapV2OracleFactory(owner).deploy(KEEP3RV1_ADDRESS, UNIV2_FACTORY);
    await oracle.setPeriodWindow(BigNumber.from(windowPeriodMinutes * 60));
  });

  xdescribe('#addPair', () => {
    it('should not allow non-owner to add a pair', async () => {
      const oracleNonOwner = ArcUniswapV2OracleFactory.connect(oracle.address, keeper);

      await expectRevert(oracleNonOwner.addPair(DIGG, WBTC));
    });

    it('should revert if duplicate pair is added', async () => {
      await oracle.addPair(KPR, WBTC);
      await expectRevert(oracle.addPair(KPR, WBTC));
      await expectRevert(oracle.addPair(WBTC, KPR));
    });

    it('should add a uniswp pair', async () => {
      await oracle.addPair(KPR, WBTC);
      expect(await oracle.getPairs()).to.have.length(1);
    });
  });

  xdescribe('#getPairs', () => {
    it('should not return any pair if none is added', async () => {
      expect(await oracle.getPairs()).to.have.length(0);
    });

    it('should return the pairs', async () => {
      await oracle.addPair(WBTC, KPR);
      await oracle.addPair(DIGG, WBTC);
      expect(await oracle.getPairs()).to.have.length(2);
    });
  });

  describe('#work', () => {
    it('should not allow non-keeper to call work()', async () => {
      await expectRevert(oracle.work());
    });

    it('should revert if work() is called before the window period', async () => {
      // add pairs
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      const keeperOracle = ArcUniswapV2OracleFactory.connect(oracle.address, keeper);

      // Make suer keeper is a registered keeper
      const keeperV1 = Keep3rV1Factory.connect(KEEP3RV1_ADDRESS, keeper);
      const isKeeper = await keeperV1.keepers(await keeper.getAddress());

      expect(isKeeper).to.be.true;

      // Need to increase time to go above the time window
      time.increase(time.duration.seconds(575));

      // Need to update the weth/kpr oracle for Keep3rV1 to work
      // const officialOracle = Keep3rV1OracleFactory.connect(UNIV2_OFFICIAL_SLIDING_ORACLE, keeper);
      // await officialOracle.workForFree();

      console.log('a');
      await keeperOracle.work();

      console.log('b');
      await expectRevert(keeperOracle.work());
    });

    xit('should update all pairs', async () => {
      // add pairs
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);
    });
  });

  // TODO check out here how to remove pair https://ethereum.stackexchange.com/a/39302
  describe('#removePair', () => {
    xit('should not allow non-owner to remove a pair', async () => {
      console.log('todo');
    });

    xit('should revert if unknown pair is removed', async () => {
      console.log('todo');
    });

    xit('should remove a uniswap pair', async () => {
      console.log('todo');
    });

    xit('should not leave any gaps in the pairs array after removal', async () => {
      console.log('todo');
    });

    xit('should remove pair from pairObservations', async () => {
      console.log('todo');
    });
  });

  describe('#updatePair', () => {
    xit('should revert if pair is not known', async () => {
      console.log('todo');
    });

    xit('should return false if not within period window', async () => {
      console.log('todo');
    });

    xit('should return true if within the period window', async () => {
      console.log('todo');
    });
  });

  describe('#updateAll', () => {
    xit('should return false if no pairs are added', async () => {
      console.log('todo');
    });

    xit('should return true if updated at least one pair', async () => {
      console.log('todo');
    });

    xit('should update all pairs', async () => {
      console.log('todo');
    });
  });

  describe('#setPeriodWindow', () => {
    xit('should throw if caller is not owner', async () => {
      console.log('todo');
    });

    xit('should revert if window is 0', async () => {
      console.log('todo');
    });
  });

  describe('#work', () => {
    xit('should revoke if caller is not keeper', async () => {
      console.log('todo');
    });

    xit('should execute the work and receive the reward', async () => {
      console.log('todo');
    });
  });

  describe('#lastObservation', () => {
    xit('should return the last observation of a pair', async () => {
      console.log('todo');
    });
  });

  describe('#workable()', () => {
    xit('should return false if there are no known pairs', async () => {
      console.log('todo');
    });

    xit('should return false if there are no workable pairs', async () => {
      console.log('todo');
    });

    xit('should return true if there exists any workable pair', async () => {
      console.log('todo');
    });
  });

  describe('#workable(pair)', () => {
    xit('should false if the pair is not known', async () => {
      console.log('todo');
    });

    xit('should return false if the pair was updated in less than periodWindow', async () => {
      console.log('todo');
    });

    xit('should return treu if the pair was updated in more than periodWindow', async () => {
      console.log('todo');
    });
  });

  describe('#current', () => {
    xit('should revert if the pair was not updated within 2 period windows', async () => {
      console.log('todo');
    });

    xit('should return the correct price', async () => {
      console.log('todo');
    });
  });

  describe('#setPeriodWindow', () => {
    xit('should not set period if it is 0', async () => {
      console.log('todo');
    });

    xit('should revert if called by non-owner', async () => {
      console.log('todo');
    });

    xit('should set the period window', async () => {
      console.log('todo');
    });
  });

  describe('#quote', () => {
    xit('should revert if the last observation of the pair is bigger than the granularity * periodWindow', async () => {
      console.log('todo');
    });

    xit('should return the right quote', async () => {
      console.log('todo');
    });
  });
});
