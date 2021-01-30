import { ArcUniswapV2Oracle, ArcUniswapV2OracleFactory } from '@src/typings';
import { ethers } from 'hardhat';
import { time } from '@openzeppelin/test-helpers';
import { BigNumber, Signer } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { expect } from 'chai';
import { MockKeep3rV1Factory } from '@src/typings/MockKeep3rV1Factory';
import ArcNumber from '@src/utils/ArcNumber';

// const KEEP3RV1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
let MOCK_KEEP3RV1_ADDRESS;
const UNIV2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
// const UNIV2_OFFICIAL_SLIDING_ORACLE = '0x73353801921417F465377c8d898c6f4C0270282C';
const DIGG = '0x798D1bE841a82a273720CE31c822C61a67a601C3';
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const KPR = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

// Set window period to 10 minutes
const windowPeriodMinutes = 10;

describe.skip('ArcUniswapV2Oracle', () => {
  let oracle: ArcUniswapV2Oracle;
  let owner: Signer;
  let keeper: Signer;
  let nonKeeper: Signer;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    keeper = signers[1];
    nonKeeper = signers[2];

    const mockKeep3rV1 = await new MockKeep3rV1Factory(owner).deploy();
    MOCK_KEEP3RV1_ADDRESS = mockKeep3rV1.address;

    const keeperMockKeep3rV1 = MockKeep3rV1Factory.connect(MOCK_KEEP3RV1_ADDRESS, keeper);

    // become keeper
    await keeperMockKeep3rV1.activate();

    oracle = await new ArcUniswapV2OracleFactory(owner).deploy(
      MOCK_KEEP3RV1_ADDRESS,
      UNIV2_FACTORY,
    );
    await oracle.setPeriodWindow(BigNumber.from(windowPeriodMinutes * 60));
  });

  describe('#addPair', () => {
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

  describe('#getPairs', () => {
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
      // When the pairs are added they are also updated so there's no need to call work
      // right after.
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      const keeperOracle = ArcUniswapV2OracleFactory.connect(oracle.address, keeper);

      // should revert because the pairs were just added and the window period was not elapsed
      await expectRevert(keeperOracle.work());
    });

    it('should update all pairs', async () => {
      // add pairs
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      const observation0 = await oracle.lastObservationTokens(WBTC, DIGG);
      const observation1 = await oracle.lastObservationTokens(WBTC, KPR);

      // Wait the time period
      await time.increase(time.duration.minutes(windowPeriodMinutes));

      const keeperOracle = ArcUniswapV2OracleFactory.connect(oracle.address, keeper);
      await keeperOracle.work();

      const lastObservation0 = await oracle.lastObservationTokens(WBTC, DIGG);
      const lastObservation1 = await oracle.lastObservationTokens(WBTC, KPR);

      expect(lastObservation0.timestamp).to.not.be.eq(observation0.timestamp);
      expect(lastObservation1.timestamp).to.not.be.eq(observation1.timestamp);
    });
  });

  describe('#removePair', () => {
    it('should not allow non-owner to remove a pair', async () => {
      await oracle.addPair(WBTC, DIGG);

      const keeperOracle = ArcUniswapV2OracleFactory.connect(oracle.address, keeper);

      await expectRevert(keeperOracle.removePair(WBTC, DIGG));
    });

    it('should revert if unknown pair is removed', async () => {
      await expectRevert(oracle.removePair(WBTC, DIGG));
    });

    it('should remove a uniswap pair', async () => {
      await oracle.addPair(WBTC, DIGG);

      await oracle.removePair(WBTC, DIGG);

      expect(await oracle.getPairs()).length(0);
    });

    it('should not leave any gaps in the pairs array after removal', async () => {
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);
      await oracle.addPair(WETH, DIGG);

      await oracle.removePair(WBTC, KPR);

      const pairs = await oracle.getPairs();

      for (const pair of pairs) {
        expect(pair).to.be.string;
      }
    });

    it('should remove pair from pairObservations', async () => {
      await oracle.addPair(WBTC, DIGG);
      const pair = await oracle.pairFor(WBTC, DIGG);

      await oracle.removePair(WBTC, DIGG);

      expect(await oracle.getPairObservations(pair)).to.have.length(0);
    });
  });

  describe('#updatePair', () => {
    it('should revert if pair is not known', async () => {
      await oracle.addPair(WBTC, DIGG);

      const pair = await oracle.pairFor(WBTC, KPR);

      await expectRevert(oracle.updatePair(pair));
    });

    it('should return false if not within period window', async () => {
      await oracle.addPair(WBTC, DIGG);

      const pair = await oracle.pairFor(WBTC, DIGG);

      const tx = await oracle.updatePair(pair);
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(0);
    });

    it('should return true if within the period window', async () => {
      await oracle.addPair(WBTC, DIGG);

      await time.increase(time.duration.minutes(windowPeriodMinutes));

      const pair = await oracle.pairFor(WBTC, DIGG);

      const tx = await oracle.updatePair(pair);
      const receipt = await tx.wait();
      expect(receipt.events).to.have.length(1);
    });
  });

  describe('#updateTokensPair', () => {
    it('should update pair', async () => {
      await oracle.addPair(WBTC, DIGG);

      await time.increase(time.duration.minutes(windowPeriodMinutes));

      const tx = await oracle.updateTokensPair(WBTC, DIGG);
      const receipt = await tx.wait();
      expect(receipt.events).to.have.length(1);
    });
  });

  describe('#updateAll', () => {
    it('should return false if no pairs are added', async () => {
      const tx = await oracle.updateAll();
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(0);
    });

    it('should return false if no pairs are updated', async () => {
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      const tx = await oracle.updateAll();
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(0);
    });

    it('should return true if updated at least one pair', async () => {
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      await time.increase(time.duration.minutes(windowPeriodMinutes));

      let tx = await oracle.updateTokensPair(WBTC, KPR);
      await tx.wait();

      tx = await oracle.updateAll();
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(1);
    });

    it('should update all pairs', async () => {
      await oracle.addPair(WBTC, DIGG);
      await oracle.addPair(WBTC, KPR);

      await time.increase(time.duration.minutes(windowPeriodMinutes));

      const tx = await oracle.updateAll();
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(1);
    });
  });

  describe('#setPeriodWindow', () => {
    it('should throw if caller is not owner', async () => {
      const nonKeeperOracle = ArcUniswapV2OracleFactory.connect(oracle.address, nonKeeper);

      await expectRevert(nonKeeperOracle.setPeriodWindow(BigNumber.from(30 * 60)));
    });

    it('should revert if window is 0', async () => {
      await expectRevert(oracle.setPeriodWindow(BigNumber.from(0)));
    });

    it('should set the period window', async () => {
      const tx = await oracle.setPeriodWindow(BigNumber.from(45));
      const receipt = await tx.wait();

      expect(receipt.events).to.have.length(1);
    });
  });

  describe('#lastObservation', () => {
    it('should revert if the pair is not known', async () => {
      const pair = await oracle.pairFor(WBTC, KPR);

      await expectRevert(oracle.lastObservation(pair));
    });

    it('should return the last observation of a pair', async () => {
      await oracle.addPair(WBTC, KPR);

      const pair = await oracle.pairFor(WBTC, KPR);

      const lastObservation = await oracle.lastObservation(pair);

      expect(lastObservation).to.not.be.null;
    });
  });

  describe('#lastObservationTokens', () => {
    it('should revert if the pair is not known', async () => {
      await expectRevert(oracle.lastObservationTokens(WBTC, KPR));
    });

    it('should return the last observation of a pair', async () => {
      await oracle.addPair(WBTC, KPR);

      const lastObservation = await oracle.lastObservationTokens(WBTC, KPR);

      expect(lastObservation).to.not.be.null;
    });
  });

  describe('#workable()', () => {
    it('should return false if there are no known pairs', async () => {
      expect(await oracle.workable()).to.be.false;
    });

    it('should return false if there are no workable pairs', async () => {
      await oracle.addPair(WBTC, KPR);
      expect(await oracle.workable()).to.be.false;
    });

    it('should return true if there exists any workable pair', async () => {
      await oracle.addPair(WBTC, KPR);

      await time.advanceBlock();
      await time.increase(time.duration.minutes(windowPeriodMinutes));

      expect(await oracle.workable()).to.be.true;
    });
  });

  describe('#workablePair', () => {
    it('should revert if the pair is not known', async () => {
      const pair = await oracle.pairFor(WBTC, KPR);
      await expectRevert(oracle.workablePair(pair));
    });

    it('should return false if the pair was updated in less than periodWindow', async () => {
      const pair = await oracle.pairFor(WBTC, KPR);
      await oracle.addPair(WBTC, KPR);
      expect(await oracle.workablePair(pair)).to.be.false;
    });

    it('should return true if the pair was updated in more than periodWindow', async () => {
      const pair = await oracle.pairFor(WBTC, KPR);
      await oracle.addPair(WBTC, KPR);

      await time.advanceBlock();
      await time.increase(time.duration.minutes(windowPeriodMinutes));

      expect(await oracle.workablePair(pair)).to.be.true;
    });
  });

  describe('#workableTokens', () => {
    it('should revert if the pair is not known', async () => {
      await expectRevert(oracle.workableTokens(WBTC, KPR));
    });

    it('should return false if the pair was updated in less than periodWindow', async () => {
      await oracle.addPair(WBTC, KPR);
      expect(await oracle.workableTokens(WBTC, KPR)).to.be.false;
    });

    it('should return true if the pair was updated in more than periodWindow', async () => {
      await oracle.addPair(WBTC, KPR);

      await time.advanceBlock();
      await time.increase(time.duration.minutes(windowPeriodMinutes));

      expect(await oracle.workableTokens(WBTC, KPR)).to.be.true;
    });
  });

  describe('#getPairObservations', () => {
    it('should return pair observations', async () => {
      await oracle.addPair(WBTC, KPR);
      await oracle.addPair(WBTC, DIGG);

      let pair = await oracle.pairFor(WBTC, KPR);
      let observations = await oracle.getPairObservations(pair);

      expect(observations).to.have.length(1);

      pair = await oracle.pairFor(WBTC, DIGG);
      observations = await oracle.getPairObservations(pair);

      expect(observations).to.have.length(1);
    });
  });

  describe('#current', () => {
    it('should revert if the pair was not updated within 2 period windows', async () => {
      await oracle.addPair(WBTC, DIGG);

      await time.advanceBlock();
      await time.increase(time.duration.minutes(windowPeriodMinutes * 3));

      await expectRevert(oracle.current(WBTC, ArcNumber.new(1), DIGG));
    });

    it('should return the correct price', async () => {
      const tx = await oracle.addPair(WETH, KPR);
      await tx.wait();

      await time.advanceBlock();

      const kprFor1Eth = await oracle.current(WETH, ArcNumber.new(1), KPR);

      console.log(`There are ${kprFor1Eth.toString()} KPR in 1 WETH`);

      expect(kprFor1Eth).to.not.eq(BigNumber.from(0));
    });
  });

  describe('#quote', () => {
    it('should revert if the last observation of the pair is bigger than the granularity * periodWindow', async () => {
      await oracle.addPair(WETH, KPR);

      await time.advanceBlock();
      await time.increase(time.duration.minutes(1));

      await expectRevert(oracle.quote(WETH, ArcNumber.new(1), KPR, BigNumber.from(2)));
    });

    it('should return a valid quote', async () => {
      await oracle.addPair(WETH, KPR);

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        await time.increase(time.duration.minutes(windowPeriodMinutes));
        await oracle.updateTokensPair(WETH, KPR);
      }

      const quote = await oracle.quote(WETH, ArcNumber.new(1), KPR, BigNumber.from(3));

      console.log(`There are ${quote.toString()} KPR in 1 WETH quoted over 3 granularities`);

      expect(quote).to.not.eq(BigNumber.from(0));
    });
  });

  describe('#setUniV2FactoryAddress', () => {
    it('should revert if called by non-owner', async () => {
      const nonOwnerOracle = ArcUniswapV2OracleFactory.connect(oracle.address, nonKeeper);
      await expectRevert(
        nonOwnerOracle.setUniV2FactoryAddress('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'),
      );
    });

    it('should revert if trying to set address 0', async () => {
      await expectRevert(
        oracle.setUniV2FactoryAddress('0x0000000000000000000000000000000000000000'),
      );
    });

    it('should set a new uniV2 factory address', async () => {
      const newAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      await oracle.setUniV2FactoryAddress(newAddress);

      expect(await oracle.uniV2Factory()).to.eq(newAddress);
    });
  });
});
