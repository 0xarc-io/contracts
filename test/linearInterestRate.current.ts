import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';
import { Blockchain } from '../src/utils/Blockchain';
import { LinearInterestRate } from '../typechain/LinearInterestRate';
import { generatedWallets } from '../src/utils/generatedWallets';
import ArcDecimal from '../src/utils/ArcDecimal';
import { MockLinearInterestRateModel } from '../typechain/MockLinearInterestRateModel';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const ONE_MINUTE = 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_YEAR = ONE_DAY * 365;
const TEN_YEARS = ONE_YEAR * 10;

jest.setTimeout(30000);

describe('LinearInterestRate', () => {
  const [ownerWallet] = generatedWallets(provider);

  async function deployModel() {
    return await MockLinearInterestRateModel.deploy(
      ownerWallet,
      ArcDecimal.new(0.02),
      ArcDecimal.new(0.46),
      ArcDecimal.new(0.25),
    );
  }

  describe('utilisation ratio = 0%', () => {
    let model: MockLinearInterestRateModel;
    const utilisationRatio = ArcDecimal.new(0);

    beforeAll(async () => {
      model = await deployModel();
    });

    test('at 0 seconds', async () => {
      await model.setTimestamp(0);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 minute', async () => {
      await model.setTimestamp(ONE_MINUTE);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 hour', async () => {
      await model.setTimestamp(ONE_HOUR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 day', async () => {
      await model.setTimestamp(ONE_DAY);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 year', async () => {
      await model.setTimestamp(ONE_YEAR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 10 year', async () => {
      await model.setTimestamp(TEN_YEARS);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });
  });

  describe('utilisation ratio = 1%', () => {
    let model: MockLinearInterestRateModel;
    const utilisationRatio = ArcDecimal.new(0.01);

    beforeAll(async () => {
      model = await deployModel();
    });

    test('at 0 seconds', async () => {
      await model.setTimestamp(0);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 minute', async () => {
      await model.setTimestamp(ONE_MINUTE);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000000046803652968));
    });

    test('at 1 hour', async () => {
      await model.setTimestamp(ONE_HOUR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000002808219178082));
    });

    test('at 1 day', async () => {
      await model.setTimestamp(ONE_DAY);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000067397260273973));
    });

    test('at 1 year', async () => {
      await model.setTimestamp(ONE_YEAR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.0246));
    });

    test('at 10 year', async () => {
      await model.setTimestamp(TEN_YEARS);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.246));
    });
  });

  describe('utilisation ratio = 25%', () => {
    let model: MockLinearInterestRateModel;
    const utilisationRatio = ArcDecimal.new(0.25);

    beforeAll(async () => {
      model = await deployModel();
    });

    test('at 0 seconds', async () => {
      await model.setTimestamp(0);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 minute', async () => {
      await model.setTimestamp(ONE_MINUTE);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000000256849315068));
    });

    test('at 1 hour', async () => {
      await model.setTimestamp(ONE_HOUR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.00001541095890411));
    });

    test('at 1 day', async () => {
      await model.setTimestamp(ONE_DAY);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.00036986301369863));
    });

    test('at 1 year', async () => {
      await model.setTimestamp(ONE_YEAR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.135));
    });

    test('at 10 year', async () => {
      await model.setTimestamp(TEN_YEARS);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(1.35));
    });
  });

  describe('utilisation ratio = 50%', () => {
    let model: MockLinearInterestRateModel;
    const utilisationRatio = ArcDecimal.new(0.5);

    beforeAll(async () => {
      model = await deployModel();
    });

    test('at 0 seconds', async () => {
      await model.setTimestamp(0);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(0);
    });

    test('at 1 minute', async () => {
      await model.setTimestamp(ONE_MINUTE);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000000475646879756));
    });

    test('at 1 hour', async () => {
      await model.setTimestamp(ONE_HOUR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000028538812785388));
    });

    test('at 1 day', async () => {
      await model.setTimestamp(ONE_DAY);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.000684931506849315));
    });

    test('at 1 year', async () => {
      await model.setTimestamp(ONE_YEAR);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(0.25));
    });

    test('at 10 year', async () => {
      await model.setTimestamp(TEN_YEARS);
      const rate = await model.calculateRate(utilisationRatio, 0);
      expect(rate).toEqual(ArcDecimal.new(2.5));
    });
  });
});
