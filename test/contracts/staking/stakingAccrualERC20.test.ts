import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import {
  ArcProxyFactory,
  DefaultPassportSkinFactory,
  DefiPassport,
  MockSablier,
  MockSablierFactory,
  SapphirePassportScoresFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { MockStakingAccrualERC20 } from '@src/typings/MockStakingAccrualERC20';
import { MockStakingAccrualERC20Factory } from '@src/typings/MockStakingAccrualERC20Factory';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import {
  addSnapshotBeforeRestoreAfterEach,
} from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { generateContext } from '../context';
import { deployDefiPassport } from '../deployers';
import { sapphireFixture } from '../fixtures';

const STAKE_AMOUNT = utils.parseEther('100');
const COOLDOWN_DURATION = 60;
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');
const STREAM_DURATION = 10;

describe('StakingAccrualERC20', () => {
  let starcx: MockStakingAccrualERC20;
  let stakingToken: TestToken;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let skinManager: SignerWithAddress;
  let userWithoutPassport: SignerWithAddress;

  let user1starcx: MockStakingAccrualERC20;
  let user2starcx: MockStakingAccrualERC20;

  let sablierContract: MockSablier;
  
  let defiPassportContract: DefiPassport;

  async function createStream(setStreamId = false) {
    const sablierId = await sablierContract.nextStreamId();
    await stakingToken.mintShare(admin.address, STAKE_AMOUNT);
    await stakingToken.approve(sablierContract.address, STAKE_AMOUNT);
    await sablierContract.createStream(
      starcx.address,
      STAKE_AMOUNT,
      stakingToken.address,
      0,
      STREAM_DURATION,
    );

    if (setStreamId) {
      await starcx.setSablierStreamId(sablierId);
    }

    return sablierId;
  }

  async function waitCooldown() {
    const currentTimestamp = await starcx.currentTimestamp();
    await starcx.setCurrentTimestamp(currentTimestamp.add(COOLDOWN_DURATION));
  }

  async function _deployStakingContract() {
    if (starcx) {
      throw Error('Contract already set up');
    }

    sablierContract = await new MockSablierFactory(admin).deploy();

    const starcxImpl = await new MockStakingAccrualERC20Factory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      starcxImpl.address,
      admin.address,
      [],
    );

    starcx = MockStakingAccrualERC20Factory.connect(proxy.address, admin);
    await starcx.init(
      'stARCx',
      'stARCx',
      18,
      stakingToken.address,
      COOLDOWN_DURATION,
      defiPassportContract.address,
      sablierContract.address,
    );

    await starcx.setProofProtocol(
      utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
    );
  }

  async function init() {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    skinManager = signers[3];
    userWithoutPassport = signers[4];
    
    defiPassportContract = await deployDefiPassport(admin);
    await defiPassportContract.init(
      'Defi Passport',
      'DefiPassport',
      skinManager.address,
    );
  }

  before(async () => {
    await generateContext(sapphireFixture, init);

    stakingToken = await new TestTokenFactory(admin).deploy('ARCx', 'ARCx', 18);

    await _deployStakingContract();
    user1starcx = starcx.connect(user1);
    user2starcx = starcx.connect(user2);

    await stakingToken.mintShare(user1.address, INITIAL_BALANCE);
    await stakingToken.mintShare(user2.address, INITIAL_BALANCE);

    await stakingToken.connect(user1).approve(starcx.address, INITIAL_BALANCE);
    await stakingToken.connect(user2).approve(starcx.address, INITIAL_BALANCE);

    // Setup default skin for defi passport
    const defaultPassportSkinContract = await new DefaultPassportSkinFactory(admin)
      .deploy('Default passport skin nft', 'DPS');
      
    await defaultPassportSkinContract.mint(admin.address, '');
    const defaultSkinTokenId = await defaultPassportSkinContract
      .tokenOfOwnerByIndex(admin.address, 0);

    await defiPassportContract
        .connect(skinManager)
        .setDefaultSkin(defaultPassportSkinContract.address, true);

    // Create a passport for users
    await defiPassportContract.connect(admin).mint(user1.address, defaultPassportSkinContract.address, defaultSkinTokenId)
    await defiPassportContract.connect(admin).mint(user2.address, defaultPassportSkinContract.address, defaultSkinTokenId)
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          user1starcx.init(
            'asdf',
            'asdf',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
            defiPassportContract.address,
            sablierContract.address,
          ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called twice', async () => {
        await expect(
          starcx.init(
            'asdf',
            'asdf',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
            defiPassportContract.address,
            sablierContract.address,
          ),
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });

      it('reverts if the staking token is address 0', async () => {
        const starcxImpl = await new MockStakingAccrualERC20Factory(
          admin,
        ).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          starcxImpl.address,
          admin.address,
          [],
        );

        const starcxProxy = MockStakingAccrualERC20Factory.connect(
          proxy.address,
          admin,
        );

        await expect(
          starcxProxy.init(
            'asdf',
            'qwer',
            18,
            constants.AddressZero,
            COOLDOWN_DURATION,
            defiPassportContract.address,
            sablierContract.address,
          ),
        ).to.be.revertedWith(
          'StakingAccrualERC20: staking token is not a contract',
        );
        await expect(
          starcxProxy.init(
            'asdf',
            'qwer',
            18,
            user1.address,
            COOLDOWN_DURATION,
            defiPassportContract.address,
            sablierContract.address,
          ),
        ).to.be.revertedWith(
          'StakingAccrualERC20: staking token is not a contract',
        );
      });

      it('sets the staking token, the staking cooldown and the sablier contract', async () => {
        expect(await starcx.stakingToken()).to.eq(stakingToken.address);
        expect(await starcx.exitCooldownDuration()).to.eq(COOLDOWN_DURATION);
        expect(await starcx.sablierContract()).to.eq(sablierContract.address);

        expect(await starcx.decimals()).to.eq(18);
        expect(await starcx.DOMAIN_SEPARATOR()).to.not.eq(
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        );
      });
    });

    describe('#setExitCooldownDuration', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          user1starcx.setExitCooldownDuration(21),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the cooldown duration', async () => {
        expect(await starcx.exitCooldownDuration()).to.eq(COOLDOWN_DURATION);

        await starcx.setExitCooldownDuration(21);

        expect(await starcx.exitCooldownDuration()).to.eq(21);
      });
    });

    describe('#recoverTokens', () => {
      beforeEach(async () => {
        await user1starcx.stake(STAKE_AMOUNT);
      });

      it('reverts if called by non-admin', async () => {
        await expect(
          user1starcx.recoverTokens(STAKE_AMOUNT.div(2)),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if trying to recover more tokens than the supply', async () => {
        await expect(
          starcx.recoverTokens(STAKE_AMOUNT.add(1)),
        ).to.be.revertedWith(
          'StakingAccrualERC20: cannot recover more than the balance',
        );
      });

      it('recovers the staked tokens and reduces the supply', async () => {
        expect(await stakingToken.balanceOf(admin.address)).to.eq(0);

        await starcx.recoverTokens(STAKE_AMOUNT.div(2));
        expect(await stakingToken.balanceOf(admin.address)).to.eq(
          STAKE_AMOUNT.div(2),
        );

        await starcx.recoverTokens(STAKE_AMOUNT.div(2));
        expect(await stakingToken.balanceOf(admin.address)).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#setSablierContract', () => {
      let otherSablier: MockSablier;

      beforeEach(async () => {
        otherSablier = await new MockSablierFactory(user1).deploy();
      });

      it('reverts if called by non-admin', async () => {
        await expect(
          user1starcx.setSablierContract(otherSablier.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the sablier contract if called the admin', async () => {
        expect(await starcx.sablierContract()).to.eq(sablierContract.address);

        await starcx.setSablierContract(otherSablier.address);

        expect(await starcx.sablierContract()).to.eq(otherSablier.address);
      });
    });

    describe('#setSablierStreamId', () => {
      it('reverts if called by non-admin', async () => {
        await expect(user1starcx.setSablierStreamId(21)).to.be.revertedWith(
          'Adminable: caller is not admin',
        );
      });

      it('reverts if setting an incorrect ID', async () => {
        await expect(starcx.setSablierStreamId(21)).to.be.revertedWith(
          'stream does not exist',
        );
      });

      it('sets the sablier stream ID', async () => {
        // We first initialize the starcx contract with the next stream id in the tests.
        // In reality it will not be like that, since we will first create the stream, then set the stream ID
        expect(await starcx.sablierStreamId()).to.eq(0);

        const sablierId = await createStream();
        await starcx.setSablierStreamId(sablierId);

        expect(await starcx.sablierStreamId()).to.eq(sablierId);
      });
    });

    describe('#setProofProtocol', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          starcx
            .connect(user1)
            .setProofProtocol(utils.formatBytes32String('asdf')),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the proof protocol', async () => {
        expect(await starcx.getProofProtocol()).to.eq(DEFAULT_PROOF_PROTOCOL);

        await starcx
          .connect(admin)
          .setProofProtocol(utils.formatBytes32String('test'));

        expect(await starcx.getProofProtocol()).to.eq('test');
      });
    });

    describe('#claimStreamFunds', () => {
      it('claims the funds from the sablier stream', async () => {
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(0);

        // Setup sablier stream by the admin to the starcx contract
        await sablierContract.setCurrentTimestamp(0);
        await createStream(true);

        await sablierContract.setCurrentTimestamp(1);
        await starcx.claimStreamFunds();
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(
          STAKE_AMOUNT.div(10),
        );

        await sablierContract.setCurrentTimestamp(2);
        await starcx.claimStreamFunds();
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(
          STAKE_AMOUNT.div(10).mul(2),
        );
      });
    });

    describe('#setDefiPassportContract', () => {
      it('reverts if called by non-admin', async () => {
        const newCs = await new SapphirePassportScoresFactory(admin).deploy();

        await expect(
          user1starcx.setDefiPassportContract(newCs.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called with set address', async () => {
        const newCs = await new SapphirePassportScoresFactory(admin).deploy();
        await starcx.setDefiPassportContract(newCs.address);

        await expect(
          starcx.setDefiPassportContract(newCs.address),
        ).to.be.revertedWith('StakingAccrualERC20: the same defi passport address is already set');
      });

      it('sets a new defi passport contract', async () => {
        const newCs = await new SapphirePassportScoresFactory(admin).deploy();
        expect(await starcx.defiPassportContract()).to.eq(
          defiPassportContract.address,
        );

        await starcx.setDefiPassportContract(newCs.address);

        expect(await starcx.defiPassportContract()).to.eq(newCs.address);
      });
    });
  });

  describe('Mutating functions', () => {
    describe('#stake', () => {
      it('reverts if user does not have a passport', async () => {
        expect(await defiPassportContract.balanceOf(userWithoutPassport.address)).eq(0)
        await expect(
          starcx.connect(userWithoutPassport).stake(STAKE_AMOUNT),
        ).to.be.revertedWith('StakingAccrualERC20: user has to have passport');
      });

      it('reverts if staking more than balance', async () => {
        const balance = await stakingToken.balanceOf(user1.address);
        await expect(
          user1starcx.stake(balance.add(1)),
        ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
      });

      it(`reverts if the user's cooldown timestamp is > 0`, async () => {
        await user1starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        await expect(
          user1starcx.stake(STAKE_AMOUNT),
        ).to.be.revertedWith(
          'StakingAccrualERC20: cannot stake during cooldown period',
        );
      });

      it('stakes the staking token and mints an equal amount of stARCx, with a proof', async () => {
        expect(await starcx.balanceOf(user1.address)).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);

        expect(await starcx.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      });

      it('withdraws from the sablier stream', async () => {
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(0);

        // Setup sablier stream by the admin to the starcx contract
        await sablierContract.setCurrentTimestamp(0);
        await createStream(true);

        await sablierContract.setCurrentTimestamp(1);
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(0);
        await user1starcx.stake(STAKE_AMOUNT);

        expect(await stakingToken.balanceOf(starcx.address)).to.eq(
          STAKE_AMOUNT.add(STAKE_AMOUNT.div(10)),
        );
      });
    });

    // describe('#stakeWithPermit', () => {
    // })

    describe('#startExitCooldown', () => {
      it('reverts if user has 0 balance', async () => {
        await expect(user1starcx.startExitCooldown()).to.be.revertedWith(
          'StakingAccrualERC20: user has 0 balance',
        );
      });

      it('starts the exit cooldown', async () => {
        let cooldownTimestamp = await starcx.cooldowns(user1.address);
        expect(cooldownTimestamp).to.eq(0);

        await starcx.setCurrentTimestamp(10);
        await user1starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        cooldownTimestamp = await starcx.cooldowns(user1.address);
        expect(cooldownTimestamp).to.eq(COOLDOWN_DURATION + 10);
      });

      it('reverts if the exit cooldown is > 0', async () => {
        await starcx.setCurrentTimestamp(10);
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await expect(user1starcx.startExitCooldown()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown already started',
        );
      });
    });

    describe('#exit', () => {
      it('reverts if user has 0 balance', async () => {
        expect(await user1starcx.balanceOf(user1.address)).eq(0);
        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: user has 0 balance',
        );
      });

      it('reverts if the cooldown timestamp is not passed', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown not elapsed',
        );
      });

      it('reverts if the startExitCooldown was not initiated', async () => {
        await user1starcx.stake(STAKE_AMOUNT);

        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown was not initiated',
        );
      });

      /**
       * It reduces the user's balance to 0, burns the respective stARCx amount
       * from the user and returns the original ARCx balance
       */
      it(`exits from the fund`, async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await waitCooldown();

        let cooldownTimestamp = await starcx.cooldowns(user1.address);
        expect(cooldownTimestamp).to.eq(COOLDOWN_DURATION);
        expect(await starcx.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.sub(STAKE_AMOUNT),
        );
        await user1starcx.exit();

        cooldownTimestamp = await starcx.cooldowns(user1.address);
        expect(cooldownTimestamp).to.eq(0);
        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE,
        );
      });

      it('withdraws from the sablier stream', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await waitCooldown();

        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.sub(STAKE_AMOUNT),
        );

        // Setup sablier stream by the admin to the starcx contract
        await sablierContract.setCurrentTimestamp(0);
        await createStream(true);

        await sablierContract.setCurrentTimestamp(1);
        await user1starcx.exit();

        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.add(STAKE_AMOUNT.div(10)),
        );
      });

      it('exits with MORE ARCx than initially if the contract has accumulated more tokens', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();
        await waitCooldown();

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        await user1starcx.exit();

        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.add(STAKE_AMOUNT.div('2')),
        );
      });

      it('exits with LESS ARCx than initially if the admin had removed tokens', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();
        await waitCooldown();

        await starcx.recoverTokens(STAKE_AMOUNT);

        await user1starcx.exit();

        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.sub(STAKE_AMOUNT.div(2)),
        );
      });

      it('exits at the end of the sablier stream', async () => {
        await sablierContract.setCurrentTimestamp(0);
        await starcx.setCurrentTimestamp(0);

        await createStream(true);

        await sablierContract.setCurrentTimestamp(1);

        await user1starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        await sablierContract.setCurrentTimestamp(COOLDOWN_DURATION);
        await starcx.setCurrentTimestamp(COOLDOWN_DURATION);

        await starcx.claimStreamFunds();

        await user1starcx.exit();

        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.add(STAKE_AMOUNT),
        );
      });
    });

    describe('#getExchangeRate', () => {
      it('updates total supply and exchange rate depends on staking and minting shares', async () => {
        expect(await starcx.toStakingToken(200)).to.eq(0);
        expect(await starcx.toStakedToken(100)).to.eq(0);
        expect(await starcx.getExchangeRate()).to.eq(0);
        expect(await starcx.totalSupply()).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);

        expect(await starcx.getExchangeRate()).to.eq(utils.parseEther('1'));
        expect(await starcx.totalSupply()).to.eq(STAKE_AMOUNT);

        await user2starcx.stake(STAKE_AMOUNT);

        expect(await starcx.getExchangeRate()).to.eq(utils.parseEther('1'));
        expect(await starcx.totalSupply()).to.eq(STAKE_AMOUNT.mul(2));

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        expect(await starcx.getExchangeRate()).to.eq(utils.parseEther('1.5'));
        expect(await starcx.totalSupply()).to.eq(STAKE_AMOUNT.mul(2));
      });
    });
  });

  // https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit#gid=1898004693
  describe('Scenarios', () => {
    async function checkState(
      exchangeRate: string,
      shareTotalSupply: string,
      balanceOfStarcx: string,
    ) {
      expect(await starcx.getExchangeRate()).to.eq(
        utils.parseEther(exchangeRate),
        'getExchangeRate',
      );
      expect(await starcx.totalSupply()).to.eq(
        utils.parseEther(shareTotalSupply),
        'totalSupply',
      );
      expect(await stakingToken.balanceOf(starcx.address)).to.eq(
        utils.parseEther(balanceOfStarcx),
        'balance of starcx contract',
      );
    }

    it('Two players with admin', async () => {
      await checkState('0', '0', '0');

      await user1starcx.stake(utils.parseEther('100'));

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'));

      await checkState('1', '300', '300');

      await stakingToken.mintShare(starcx.address, utils.parseEther('300'));

      await checkState('2', '300', '600');

      await stakingToken.mintShare(starcx.address, utils.parseEther('300'));

      await checkState('3', '300', '900');

      await starcx.recoverTokens(utils.parseEther('450'));

      await checkState('1.5', '300', '450');

      await checkUser(starcx, user1);
    });

    it('Two players without admin', async () => {
      await checkState('0', '0', '0');

      await user1starcx.stake(utils.parseEther('100'));

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'));

      await checkState('1', '300', '300');

      await user1starcx.stake(utils.parseEther('200'));

      await checkState('1', '500', '500');

      await checkUser(starcx, user1);

      await user1starcx.startExitCooldown();
      await waitCooldown();
      await user1starcx.exit();

      await checkState('1', '200', '200');

      await user2starcx.startExitCooldown();
      await waitCooldown();
      await user2starcx.exit();

      await checkState('0', '0', '0');
    });

    it('Complex scenario', async () => {
      await checkState('0', '0', '0');

      await user1starcx.stake(utils.parseEther('100'));

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'));

      await checkState('1', '300', '300');
      await checkUser(starcx, user1);
      await checkUser(starcx, user2);

      await user2starcx.stake(utils.parseEther('50'));

      await checkState('1', '350', '350');

      await stakingToken.mintShare(starcx.address, utils.parseEther('350'));

      await checkState('2', '350', '700');
      await checkUser(starcx, user1);
      await checkUser(starcx, user2);

      await user2starcx.startExitCooldown();
      await waitCooldown();
      await user2starcx.exit();

      await checkState('2', '100', '200');

      await stakingToken.mintShare(starcx.address, utils.parseEther('50'));

      await checkState('2.5', '100', '250');

      await user1starcx.startExitCooldown();
      await waitCooldown();
      await user1starcx.exit();

      await checkState('0', '0', '0');

      await stakingToken.mintShare(starcx.address, utils.parseEther('200'));

      await checkState('0', '0', '200');

      await user1starcx.stake(utils.parseEther('50'));

      await checkState('1', '250', '250');

      await stakingToken.mintShare(starcx.address, utils.parseEther('125'));

      await checkState('1.5', '250', '375');

      await user2starcx.stake(utils.parseEther('150'));

      await checkState('1.5', '350', '525');

      await stakingToken.mintShare(starcx.address, utils.parseEther('175'));

      await checkState('2', '350', '700');

      await user1starcx.startExitCooldown();
      await waitCooldown();
      await user1starcx.exit();

      await checkState('2', '100', '200');

      await starcx.recoverTokens(utils.parseEther('50'));

      await checkState('1.5', '100', '150');

      await user2starcx.startExitCooldown();
      await waitCooldown();
      await user2starcx.exit();

      await checkState('0', '0', '0');
    });
  });
});

async function checkUser(
  starcx: MockStakingAccrualERC20,
  user: SignerWithAddress,
) {
  const stArcxBalance = await starcx.balanceOf(user.address);
  const arcAmount = await starcx.toStakingToken(stArcxBalance);
  expect(arcAmount).eq(
    stArcxBalance.mul(await starcx.getExchangeRate()).div(BASE),
  );
  expect(await starcx.toStakedToken(arcAmount)).eq(stArcxBalance);
}
