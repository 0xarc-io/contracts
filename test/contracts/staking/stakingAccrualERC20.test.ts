import { CreditScoreProof } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import { CreditScoreTree } from '@src/MerkleTree';
import {
  ArcProxyFactory,
  MockSablier,
  MockSablierFactory,
  MockSapphireCreditScore,
  SapphireCreditScoreFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { MockStakingAccrualERC20 } from '@src/typings/MockStakingAccrualERC20';
import { MockStakingAccrualERC20Factory } from '@src/typings/MockStakingAccrualERC20Factory';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';

const STAKE_AMOUNT = utils.parseEther('100');
const COOLDOWN_DURATION = 60;
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');

describe('StakingAccrualERC20', () => {
  let starcx: MockStakingAccrualERC20;
  let stakingToken: TestToken;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  let user1starcx: MockStakingAccrualERC20;
  let user2starcx: MockStakingAccrualERC20;

  let sablierContract: MockSablier;

  let creditScoreTree: CreditScoreTree;
  let user1ScoreProof: CreditScoreProof;
  let user2ScoreProof: CreditScoreProof;

  let creditScoreContract: MockSapphireCreditScore;

  async function createStream(setStreamId = false) {
    const sablierId = await sablierContract.nextStreamId();
    await stakingToken.mintShare(admin.address, STAKE_AMOUNT);
    await stakingToken.approve(sablierContract.address, STAKE_AMOUNT);
    await sablierContract.createStream(
      starcx.address,
      STAKE_AMOUNT,
      stakingToken.address,
      0,
      10,
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

  async function _deployContract() {
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
      creditScoreContract.address,
      sablierContract.address,
    );
  }

  async function init(ctx: ITestContext) {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    const user1CreditScore = {
      account: user1.address,
      amount: BigNumber.from(1),
    };
    const user2CreditScore = {
      account: user2.address,
      amount: BigNumber.from(1),
    };

    creditScoreTree = new CreditScoreTree([user1CreditScore, user2CreditScore]);

    user1ScoreProof = getScoreProof(user1CreditScore, creditScoreTree);
    user2ScoreProof = getScoreProof(user2CreditScore, creditScoreTree);

    creditScoreContract = ctx.contracts.sapphire.creditScore;

    await immediatelyUpdateMerkleRoot(
      creditScoreContract.connect(ctx.signers.interestSetter),
      creditScoreTree.getHexRoot(),
    );
  }

  before(async () => {
    await generateContext(sapphireFixture, init);

    stakingToken = await new TestTokenFactory(admin).deploy('ARCx', 'ARCx', 18);

    await _deployContract();

    user1starcx = starcx.connect(user1);
    user2starcx = starcx.connect(user2);

    await stakingToken.mintShare(user1.address, INITIAL_BALANCE);
    await stakingToken.mintShare(user2.address, INITIAL_BALANCE);

    await stakingToken.connect(user1).approve(starcx.address, INITIAL_BALANCE);
    await stakingToken.connect(user2).approve(starcx.address, INITIAL_BALANCE);
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
            creditScoreContract.address,
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
            creditScoreContract.address,
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
            creditScoreContract.address,
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
            creditScoreContract.address,
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

        expect(await starcx.decimals()).to.eq(18)
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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
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
          'revert stream does not exist',
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

    describe('#setCreditScoreContract', () => {
      it('reverts if called by non-admin', async () => {
        const newCs = await new SapphireCreditScoreFactory(admin).deploy()
        
        await expect(user1starcx.setCreditScoreContract(newCs.address)).to.be.revertedWith(
          'Adminable: caller is not admin',
        );
      })

      it('sets a new credit score contract', async () => {
        const newCs = await new SapphireCreditScoreFactory(admin).deploy()

        expect(await starcx.creditScoreContract()).to.eq(creditScoreContract.address)

        await starcx.setCreditScoreContract(newCs.address)

        expect(await starcx.creditScoreContract()).to.eq(newCs.address)
      })
    })
    
  });

  describe('Mutating functions', () => {
    describe('#stake', () => {
      it(`reverts if staking with someone else's proof`, async () => {
        // Also try to stake with a proof other than the user's
        await expect(
          user1starcx.stake(STAKE_AMOUNT, user2ScoreProof),
        ).to.be.revertedWith(
          'CreditScoreVerifiable: proof does not belong to the caller',
        );
      });

      it('reverts if staking with no proof', async () => {
        await expect(
          user1starcx.stake(STAKE_AMOUNT, getEmptyScoreProof()),
        ).to.be.revertedWith(
          'CreditScoreVerifiable: proof is required but it is not passed',
        );
      });

      it('reverts if staking more than balance', async () => {
        const balance = await stakingToken.balanceOf(user1.address);
        await expect(
          user1starcx.stake(balance.add(1), user1ScoreProof),
        ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
      });

      it(`reverts if the user's cooldown timestamp is > 0`, async () => {
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

        await user1starcx.startExitCooldown();

        await expect(
          user1starcx.stake(STAKE_AMOUNT, user1ScoreProof),
        ).to.be.revertedWith(
          'StakingAccrualERC20: cannot stake during cooldown period',
        );
      });

      it('stakes the staking token and mints an equal amount of stARCx, with a proof', async () => {
        expect(await starcx.balanceOf(user1.address)).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

        expect(await starcx.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      });

      it('withdraws from the sablier stream', async () => {
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(0);

        // Setup sablier stream by the admin to the starcx contract
        await sablierContract.setCurrentTimestamp(0);
        await createStream(true);

        await sablierContract.setCurrentTimestamp(1);
        expect(await stakingToken.balanceOf(starcx.address)).to.eq(0);
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

        await user1starcx.startExitCooldown();

        cooldownTimestamp = await starcx.cooldowns(user1.address);
        expect(cooldownTimestamp).to.eq(COOLDOWN_DURATION + 10);
      });

      it('reverts if the exit cooldown is > 0', async () => {
        await starcx.setCurrentTimestamp(10);
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
        await user1starcx.startExitCooldown();

        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown not elapsed',
        );
      });

      it('reverts if the startExitCooldown was not initiated', async () => {
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown was not initiated',
        );
      });

      /**
       * It reduces the user's balance to 0, burns the respective stARCx amount
       * from the user and returns the original ARCx balance
       */
      it(`exits from the fund`, async () => {
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
        await user2starcx.stake(STAKE_AMOUNT, user2ScoreProof);

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
        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);
        await user2starcx.stake(STAKE_AMOUNT, user2ScoreProof);

        await user1starcx.startExitCooldown();
        await waitCooldown();

        await starcx.recoverTokens(STAKE_AMOUNT);

        await user1starcx.exit();

        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          INITIAL_BALANCE.sub(STAKE_AMOUNT.div(2)),
        );
      });
    });

    describe('#getExchangeRate', () => {
      it('updates total supply and exchange rate depends on staking and minting shares', async () => {
        expect(await starcx.toStakingToken(200)).to.eq(0);
        expect(await starcx.toStakedToken(100)).to.eq(0);
        expect(await starcx.getExchangeRate()).to.eq(0);
        expect(await starcx.totalSupply()).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT, user1ScoreProof);

        expect(await starcx.getExchangeRate()).to.eq(utils.parseEther('1'));
        expect(await starcx.totalSupply()).to.eq(STAKE_AMOUNT);

        await user2starcx.stake(STAKE_AMOUNT, user2ScoreProof);

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

      await user1starcx.stake(utils.parseEther('100'), user1ScoreProof);

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'), user2ScoreProof);

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

      await user1starcx.stake(utils.parseEther('100'), user1ScoreProof);

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'), user2ScoreProof);

      await checkState('1', '300', '300');

      await user1starcx.stake(utils.parseEther('200'), user1ScoreProof);

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

      await user1starcx.stake(utils.parseEther('100'), user1ScoreProof);

      await checkState('1', '100', '100');

      await user2starcx.stake(utils.parseEther('200'), user2ScoreProof);

      await checkState('1', '300', '300');
      await checkUser(starcx, user1);
      await checkUser(starcx, user2);

      await user2starcx.stake(utils.parseEther('50'), user2ScoreProof);

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

      await user1starcx.stake(utils.parseEther('50'), user1ScoreProof);

      await checkState('1', '250', '250');

      await stakingToken.mintShare(starcx.address, utils.parseEther('125'));

      await checkState('1.5', '250', '375');

      await user2starcx.stake(utils.parseEther('150'), user2ScoreProof);

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
