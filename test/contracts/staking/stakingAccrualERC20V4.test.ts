import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkinFactory,
  MockSablierFactory,
  StakingAccrualERC20,
  StakingAccrualERC20Factory,
  StakingAccrualERC20V4,
  StakingAccrualERC20V4Factory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../deployers';

const COOLDOWN_DURATION = 60;
const STAKE_AMOUNT = utils.parseEther('100');
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');

describe('StakingAccrualERC20V4', () => {
  let contract: StakingAccrualERC20V4;

  let stakingToken: TestToken;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  async function _baseContractSetup(): Promise<StakingAccrualERC20> {
    let baseContract = await new StakingAccrualERC20Factory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      baseContract.address,
      admin.address,
      [],
    );

    // Set up defi passport
    const defiPassportContract = await deployDefiPassport(admin);
    await defiPassportContract.init(
      'Defi Passport',
      'DefiPassport',
      admin.address,
    );

    const sablierContract = await new MockSablierFactory(admin).deploy();

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

    return baseContract;
  }

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];

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
    const v4Impl = await new StakingAccrualERC20V4Factory(admin).deploy();
    const proxy = ArcProxyFactory.connect(baseContract.address, admin);
    await proxy.upgradeTo(v4Impl.address);
    contract = StakingAccrualERC20V4Factory.connect(proxy.address, admin);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Upgradability', () => {
    it('ensures starcx balances are unchanged');

    it('ensures users can exit');
  });

  describe('#stake', () => {
    it('reverts if proof is set and no proof is provided');

    it('reverts if proof is set and the wrong proof is passed');

    it('reverts if proof is set and the score is smaller than the threshold');

    it(
      'stakes if proof is set and score is greater than or equal to the threshold',
    );

    it('stakes if no proof is passed');
  });

  describe('#setProofProtocol', () => {
    it('reverts if called by non-admin');

    it('sets the proof protocol and the score threshold');
  });
});
