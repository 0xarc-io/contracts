import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefaultPassportSkinFactory,
  DefiPassport,
  MockSablierFactory,
  MockStakingAccrualERC20V4,
  MockStakingAccrualERC20V4Factory,
  StakingAccrualERC20,
  StakingAccrualERC20Factory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { getEmptyScoreProof } from '@src/utils';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { utils, BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../deployers';

const COOLDOWN_DURATION = 60;
const DEFAULT_SCORE_THRESHOLD = 500;
const STAKE_AMOUNT = utils.parseEther('100');
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');

describe('StakingAccrualERC20V4', () => {
  let contract: MockStakingAccrualERC20V4;

  let stakingToken: TestToken;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  async function _setupUsers(
    baseContract: StakingAccrualERC20,
    defiPassportContract: DefiPassport,
    defaultPassportSkinContract: DefaultPassportSkin,
    defaultSkinTokenId: BigNumber,
  ) {
    // Mint test tokens to users
    const user1starcx = baseContract.connect(user1);
    const user2starcx = baseContract.connect(user2);

    await stakingToken.mintShare(user1.address, INITIAL_BALANCE);
    await stakingToken.mintShare(user2.address, INITIAL_BALANCE);

    // Mint DefiPassports to users
    await stakingToken
      .connect(user1)
      .approve(baseContract.address, INITIAL_BALANCE);
    await stakingToken
      .connect(user2)
      .approve(baseContract.address, INITIAL_BALANCE);

    await defiPassportContract
      .connect(admin)
      .mint(
        user1.address,
        defaultPassportSkinContract.address,
        defaultSkinTokenId,
      );
    await defiPassportContract
      .connect(admin)
      .mint(
        user2.address,
        defaultPassportSkinContract.address,
        defaultSkinTokenId,
      );

    // Two users stake
    await user1starcx.stake(STAKE_AMOUNT);
    await user2starcx.stake(STAKE_AMOUNT);
  }

  async function _setupDefiPassport() {
    const defiPassportContract = await deployDefiPassport(admin);
    await defiPassportContract.init(
      'Defi Passport',
      'DefiPassport',
      admin.address,
    );

    const sablierContract = await new MockSablierFactory(admin).deploy();

    // Setup default skin for defi passport
    const defaultPassportSkinContract = await new DefaultPassportSkinFactory(
      admin,
    ).deploy('Default passport skin nft', 'DPS');

    await defaultPassportSkinContract.mint(admin.address, '');
    const defaultSkinTokenId = await defaultPassportSkinContract.tokenOfOwnerByIndex(
      admin.address,
      0,
    );

    await defiPassportContract.setDefaultSkin(
      defaultPassportSkinContract.address,
      true,
    );

    return {
      defiPassportContract,
      sablierContract,
      defaultPassportSkinContract,
      defaultSkinTokenId,
    };
  }

  async function _baseContractSetup(): Promise<StakingAccrualERC20> {
    let baseContract = await new StakingAccrualERC20Factory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      baseContract.address,
      admin.address,
      [],
    );

    const {
      defiPassportContract,
      sablierContract,
      defaultPassportSkinContract,
      defaultSkinTokenId,
    } = await _setupDefiPassport();

    baseContract = StakingAccrualERC20Factory.connect(proxy.address, admin);
    await baseContract.init(
      'stARCx',
      'stARCx',
      18,
      stakingToken.address,
      COOLDOWN_DURATION,
      defiPassportContract.address,
      sablierContract.address,
    );

    await _setupUsers(
      baseContract,
      defiPassportContract,
      defaultPassportSkinContract,
      defaultSkinTokenId,
    );

    return baseContract;
  }

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    stakingToken = await new TestTokenFactory(admin).deploy(
      'Staking Token',
      'STK',
      18,
    );

    // set up base contract with two DefiPassport owners who are also stakers
    const baseContract = await _baseContractSetup();

    // top up some tokens on the contract
    await stakingToken.mintShare(baseContract.address, STAKE_AMOUNT);

    // contract is upgraded
    const v4Impl = await new MockStakingAccrualERC20V4Factory(admin).deploy();
    const proxy = ArcProxyFactory.connect(baseContract.address, admin);
    await proxy.upgradeTo(v4Impl.address);
    contract = MockStakingAccrualERC20V4Factory.connect(proxy.address, admin);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Upgradability', () => {
    it('ensures starcx balances are unchanged', async () => {
      expect(await contract.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      expect(await contract.balanceOf(user2.address)).to.eq(STAKE_AMOUNT);
    });

    it('ensures users can exit', async () => {
      const remainingAmt = INITIAL_BALANCE.sub(STAKE_AMOUNT);
      // We are adding an extra STAKE_AMOUNT on top of what's staked to simulate
      // rewards flowing into the contract. For this reason, the users end up with an
      // additional STAKE_AMOUNT/2 in their wallet after exit.
      const expectedExitAmt = INITIAL_BALANCE.add(STAKE_AMOUNT.div(2));

      expect(await stakingToken.balanceOf(user1.address)).to.eq(remainingAmt);
      expect(await stakingToken.balanceOf(user2.address)).to.eq(remainingAmt);

      await contract.connect(user1).startExitCooldown();
      await contract.setCurrentTimestamp(COOLDOWN_DURATION + 1);
      await contract.connect(user1).exit();
      expect(await stakingToken.balanceOf(user1.address)).to.eq(
        expectedExitAmt,
      );

      await contract.connect(user2).startExitCooldown();
      await contract.setCurrentTimestamp(COOLDOWN_DURATION * 2 + 1);
      await contract.connect(user2).exit();
      expect(await stakingToken.balanceOf(user2.address)).to.eq(
        expectedExitAmt,
      );
    });
  });

  describe('#stake', () => {
    it('reverts if proof is set and no proof is provided', async () => {
      await contract.setProofProtocol(
        utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      );
      await contract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD);

      expect(contract.getProofProtocol()).to.eq(DEFAULT_PROOF_PROTOCOL);
      expect(contract.getScoreThreshold()).to.eq(DEFAULT_SCORE_THRESHOLD);

      await expect(
        contract.stake(
          STAKE_AMOUNT,
          getEmptyScoreProof(user1.address, DEFAULT_PROOF_PROTOCOL),
        ),
      ).to.be.revertedWith(
        'PassportScoreVerifiable: proof does not belong to the caller',
      );
    });

    it('reverts if proof is set and the wrong proof is passed');

    it('reverts if proof is set and the score is smaller than the threshold');

    it(
      'stakes if proof is set and score is greater than or equal to the threshold',
    );

    it('stakes if no proof is passed');
  });

  describe('#setProofProtocol', () => {
    it('reverts if called by non-admin');

    it('sets the proof protocol');
  });

  describe('#setScoreThreshold', () => {
    it('reverts if called by non-admin');

    it('sets the score threshold');
  });
});
