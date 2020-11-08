import 'module-alias/register';

import ArcDecimal from '@src/utils/ArcDecimal';
import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';
import { BigNumber } from 'ethers/utils';
import { ADMINABLE_ERROR, INTEREST_SETTER_ERROR } from '../../helpers/contractErrors';
import { getAccounts } from '../../helpers/testingUtils';
import { MockD2CoreV1, MockOracle, SyntheticToken, ArcProxy, TestToken } from '@src/typings';
import { Signer } from 'ethers';

let ownerAccount: Account;
let interestSetterAccount: Account;
let otherAccount: Account;

const expect = getWaffleExpect();

describe('D2Core.setters', () => {
  let core: MockD2CoreV1;

  before(async () => {
    [ownerAccount, interestSetterAccount, otherAccount] = await getAccounts();

    const mockCore = await MockD2CoreV1.deploy(ownerAccount.signer);

    const collateralAsset = await TestToken.deploy(ownerAccount.signer, 'TestCollateral', 'TEST');
    const syntheticAsset = await SyntheticToken.deploy(ownerAccount.signer, 'ETHX', 'ETHX');

    const oracle = await MockOracle.deploy(ownerAccount.signer);
    const proxy = await ArcProxy.deploy(
      ownerAccount.signer,
      mockCore.address,
      ownerAccount.address,
      [],
    );

    core = await MockD2CoreV1.at(ownerAccount.signer, proxy.address);
    await core.setInterestSetter(interestSetterAccount.address);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getCore(signer: Signer) {
    return await MockD2CoreV1.at(signer, core.address);
  }

  describe('#init', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(
        contract.init(
          otherAccount.address,
          otherAccount.address,
          otherAccount.address,
          interestSetterAccount.address,
          { value: 2 },
          { value: 4 },
          { value: 5 },
        ),
      ).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.init(
        otherAccount.address,
        otherAccount.address,
        otherAccount.address,
        interestSetterAccount.address,
        { value: 2 },
        { value: 4 },
        { value: 5 },
      );
      expect(await contract.getCollateralAsset()).to.equal(otherAccount.address);
      expect(await contract.getSyntheticAsset()).to.equal(otherAccount.address);
      expect(await contract.getCurrentOracle()).to.equal(otherAccount.address);
      expect(await contract.getInterestSetter()).to.equal(interestSetterAccount.address);
    });
  });

  describe('#setInterestRate', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setRate(999)).to.be.reverted;
    });

    it('should only be settable by the setter', async () => {
      const contract = await getCore(interestSetterAccount.signer);
      await contract.setRate(999);
      await expect(await contract.getInterestRate()).to.equal(new BigNumber(999));
    });
  });

  describe('#setOracle', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setOracle(ownerAccount.address)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.setOracle(ownerAccount.address);
      expect(await contract.getCurrentOracle()).to.equal(ownerAccount.address);
    });
  });

  describe('#setCollateralRatio', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setCollateralRatio(ArcDecimal.new(5))).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.setCollateralRatio(ArcDecimal.new(5));
      expect(await (await contract.getCollateralRatio()).value).to.equal(ArcDecimal.new(5).value);
    });
  });

  describe('#setLiquidationFees', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setFees(ArcDecimal.new(5), ArcDecimal.new(5))).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.setFees(ArcDecimal.new(5), ArcDecimal.new(0.5));
      const fees = await contract.getFees();
      expect(fees._liquidationUserFee.value).to.equal(ArcDecimal.new(5).value);
      expect(fees._liquidationArcRatio.value).to.equal(ArcDecimal.new(0.5).value);
    });
  });

  describe('#setLimits', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setLimits(1, 2, 3)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.setLimits(1, 2, 3);
      expect((await contract.getLimits())[0]).to.equal(new BigNumber(1));
      expect((await contract.getLimits())[1]).to.equal(new BigNumber(2));
      expect((await contract.getLimits())[2]).to.equal(new BigNumber(3));
    });
  });

  describe('#setInterestSetter', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(contract.setInterestSetter(ownerAccount.address)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.setInterestSetter(ownerAccount.address);
      expect(await contract.getInterestSetter()).to.equal(ownerAccount.address);
    });
  });
});
