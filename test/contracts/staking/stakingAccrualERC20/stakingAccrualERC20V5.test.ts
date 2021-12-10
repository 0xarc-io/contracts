import { PassportScoreProof } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefaultPassportSkinFactory,
  DefiPassport,
  MockSablier,
  MockSablierFactory,
  MockSapphirePassportScores,
  MockStakingAccrualERC20V5,
  MockStakingAccrualERC20V5Factory,
  StakingAccrualERC20,
  StakingAccrualERC20Factory,
  StakingAccrualERC20V5,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { approve, getEmptyScoreProof, getScoreProof } from '@src/utils';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { utils, BigNumber, constants } from 'ethers';
import { generateContext, ITestContext } from '../../context';
import { deployDefiPassport } from '../../deployers';
import { sapphireFixture } from '../../fixtures';
import checkUserBalance from './checkUserBalance';
import createStream from './createSablierStream';
import waitCooldown from './waitCooldown';

const COOLDOWN_DURATION = 60;
const STREAM_DURATION = 10;
const DEFAULT_SCORE_THRESHOLD = 500;
const STAKE_AMOUNT = utils.parseEther('100');
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');

interface IDPDetails {
  defiPassportContract: DefiPassport;
  sablierContract: MockSablier;
  defaultPassportSkinContract: DefaultPassportSkin;
  defaultSkinTokenId: BigNumber;
}

describe('StakingAccrualERC20V5', () => {
  let contract: MockStakingAccrualERC20V5;

  let stakingToken: TestToken;
  let tree: PassportScoreTree;
  let passportScores: MockSapphirePassportScores;
  let sablierContract: MockSablier;
  let defiPassportDetails: IDPDetails;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let scoreProof1: PassportScoreProof;
  let scoreProof2: PassportScoreProof;

  async function _setupUserBalances() {
    await stakingToken.mintShare(user1.address, INITIAL_BALANCE);
    await stakingToken.mintShare(user2.address, INITIAL_BALANCE);

    // Mint DefiPassports to users
    await stakingToken
      .connect(user1)
      .approve(contract.address, INITIAL_BALANCE);
    await stakingToken
      .connect(user2)
      .approve(contract.address, INITIAL_BALANCE);
  }

  async function _setupDefiPassport() {
    const defiPassportContract = await deployDefiPassport(admin);
    await defiPassportContract.init(
      'Defi Passport',
      'DefiPassport',
      admin.address,
    );

    sablierContract = await new MockSablierFactory(admin).deploy();

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

    // Mint defi passport to users
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

    defiPassportDetails = {
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

    const { defiPassportContract } = defiPassportDetails;

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

    return baseContract;
  }

  async function init(ctx: ITestContext) {
    admin = ctx.signers.admin;
    user1 = ctx.signers.scoredMinter;
    user2 = ctx.signers.staker;

    await _setupDefiPassport();

    stakingToken = await new TestTokenFactory(admin).deploy(
      'Staking Token',
      'STK',
      18,
    );

    // set up base contract with two DefiPassport owners who are also stakers
    // const baseContract = await _baseContractSetup();

    // top up some tokens on the contract
    // await stakingToken.mintShare(baseContract.address, STAKE_AMOUNT);

    // contract is upgraded
    const v4Impl = await new MockStakingAccrualERC20V5Factory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      v4Impl.address,
      admin.address,
      [],
    );
    await proxy.upgradeTo(v4Impl.address);
    contract = MockStakingAccrualERC20V5Factory.connect(proxy.address, admin);

    await contract.init(
      'stARCx',
      'stARCx',
      18,
      stakingToken.address,
      COOLDOWN_DURATION,
      defiPassportDetails.sablierContract.address,
    );
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    passportScores = ctx.contracts.sapphire.passportScores;

    const score1 = {
      account: user1.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(DEFAULT_SCORE_THRESHOLD),
    };
    const score2 = {
      account: user2.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(DEFAULT_SCORE_THRESHOLD),
    };

    tree = new PassportScoreTree([score1, score2]);

    scoreProof1 = getScoreProof(score1, tree);
    scoreProof2 = getScoreProof(score2, tree);

    await contract.setPassportScoresContract(passportScores.address);
    await immediatelyUpdateMerkleRoot(
      passportScores.connect(ctx.signers.interestSetter),
      tree.getHexRoot(),
    );

    await _setupUserBalances();
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Base functionality tests', () => {
    describe('Admin functions', () => {
      let uninitializedContract: MockStakingAccrualERC20V5;

      before(async () => {
        const uninitializedContractImpl = await new MockStakingAccrualERC20V5Factory(
          admin,
        ).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          uninitializedContractImpl.address,
          admin.address,
          [],
        );
        uninitializedContract = MockStakingAccrualERC20V5Factory.connect(
          proxy.address,
          admin,
        );
      });

      describe('#init', () => {
        it('reverts if called by non-admin', async () => {
          await expect(
            uninitializedContract
              .connect(user1)
              .init(
                'asdf',
                'asdf',
                18,
                stakingToken.address,
                COOLDOWN_DURATION,
                sablierContract.address,
              ),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('reverts if called twice', async () => {
          await uninitializedContract.init(
            'test',
            'test',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
            sablierContract.address,
          );

          await expect(
            uninitializedContract.init(
              'asdf',
              'asdf',
              18,
              stakingToken.address,
              COOLDOWN_DURATION,
              sablierContract.address,
            ),
          ).to.be.revertedWith(
            'Initializable: contract is already initialized',
          );
        });

        it('reverts if the staking token is address 0', async () => {
          await expect(
            uninitializedContract.init(
              'asdf',
              'qwer',
              18,
              constants.AddressZero,
              COOLDOWN_DURATION,
              sablierContract.address,
            ),
          ).to.be.revertedWith(
            'StakingAccrualERC20V5: staking token is not a contract',
          );
          await expect(
            uninitializedContract.init(
              'asdf',
              'qwer',
              18,
              user1.address,
              COOLDOWN_DURATION,
              sablierContract.address,
            ),
          ).to.be.revertedWith(
            'StakingAccrualERC20V5: staking token is not a contract',
          );
        });

        it('sets the staking token, the staking cooldown and the sablier contract', async () => {
          await uninitializedContract.init(
            'test',
            'test',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
            sablierContract.address,
          );

          expect(await uninitializedContract.stakingToken()).to.eq(
            stakingToken.address,
          );
          expect(await uninitializedContract.exitCooldownDuration()).to.eq(
            COOLDOWN_DURATION,
          );
          expect(await uninitializedContract.sablierContract()).to.eq(
            sablierContract.address,
          );

          expect(await uninitializedContract.decimals()).to.eq(18);
          expect(await uninitializedContract.DOMAIN_SEPARATOR()).to.not.eq(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          );
        });
      });

      describe('#setExitCooldownDuration', () => {
        it('reverts if called by non-admin', async () => {
          await expect(
            contract.connect(user1).setExitCooldownDuration(21),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('sets the cooldown duration', async () => {
          expect(await contract.exitCooldownDuration()).to.eq(
            COOLDOWN_DURATION,
          );

          await contract.setExitCooldownDuration(21);

          expect(await contract.exitCooldownDuration()).to.eq(21);
        });
      });

      describe('#recoverTokens', () => {
        beforeEach(async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
        });

        it('reverts if called by non-admin', async () => {
          await expect(
            contract.connect(user1).recoverTokens(STAKE_AMOUNT.div(2)),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('reverts if trying to recover more tokens than the supply', async () => {
          await expect(
            contract.recoverTokens(STAKE_AMOUNT.add(1)),
          ).to.be.revertedWith(
            'StakingAccrualERC20V5: cannot recover more than the balance',
          );
        });

        it('recovers the staked tokens and reduces the supply', async () => {
          expect(await stakingToken.balanceOf(admin.address)).to.eq(0);

          await contract.recoverTokens(STAKE_AMOUNT.div(2));
          expect(await stakingToken.balanceOf(admin.address)).to.eq(
            STAKE_AMOUNT.div(2),
          );

          await contract.recoverTokens(STAKE_AMOUNT.div(2));
          expect(await stakingToken.balanceOf(admin.address)).to.eq(
            STAKE_AMOUNT,
          );
        });
      });

      describe('#setSablierContract', () => {
        let otherSablier: MockSablier;

        beforeEach(async () => {
          otherSablier = await new MockSablierFactory(user1).deploy();
        });

        it('reverts if called by non-admin', async () => {
          await expect(
            contract.connect(user1).setSablierContract(otherSablier.address),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('sets the sablier contract if called the admin', async () => {
          expect(await contract.sablierContract()).to.eq(
            sablierContract.address,
          );

          await contract.setSablierContract(otherSablier.address);

          expect(await contract.sablierContract()).to.eq(otherSablier.address);
        });
      });

      describe('#setSablierStreamId', () => {
        it('reverts if called by non-admin', async () => {
          await expect(
            contract.connect(user1).setSablierStreamId(21),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('reverts if setting an incorrect ID', async () => {
          await expect(contract.setSablierStreamId(21)).to.be.revertedWith(
            'stream does not exist',
          );
        });

        it('sets the sablier stream ID', async () => {
          // We first initialize the starcx contract with the next stream id in the tests.
          // In reality it will not be like that, since we will first create the stream, then set the stream ID
          expect(await contract.sablierStreamId()).to.eq(0);

          const sablierId = await createStream(
            sablierContract,
            stakingToken,
            contract,
            STAKE_AMOUNT,
            STREAM_DURATION,
          );
          await contract.setSablierStreamId(sablierId);

          expect(await contract.sablierStreamId()).to.eq(sablierId);
        });
      });

      describe('#setProofProtocol', () => {
        it('reverts if called by non-admin', async () => {
          await expect(
            contract
              .connect(user1)
              .setProofProtocol(utils.formatBytes32String('asdf')),
          ).to.be.revertedWith('Adminable: caller is not admin');
        });

        it('sets the proof protocol', async () => {
          expect(await contract.getProofProtocol()).to.eq('');

          await contract
            .connect(admin)
            .setProofProtocol(utils.formatBytes32String('test'));

          expect(await contract.getProofProtocol()).to.eq('test');
        });
      });

      describe('#claimStreamFunds', () => {
        it('claims the funds from the sablier stream', async () => {
          expect(await stakingToken.balanceOf(contract.address)).to.eq(0);

          // Setup sablier stream by the admin to the starcx contract
          await sablierContract.setCurrentTimestamp(0);
          await createStream(
            sablierContract,
            stakingToken,
            contract,
            STAKE_AMOUNT,
            STREAM_DURATION,
            true,
          );

          await sablierContract.setCurrentTimestamp(1);
          await contract.claimStreamFunds();
          expect(await stakingToken.balanceOf(contract.address)).to.eq(
            STAKE_AMOUNT.div(10),
          );

          await sablierContract.setCurrentTimestamp(2);
          await contract.claimStreamFunds();
          expect(await stakingToken.balanceOf(contract.address)).to.eq(
            STAKE_AMOUNT.div(10).mul(2),
          );
        });
      });
    });

    describe('Mutating functions', () => {
      describe('#stake', () => {
        it('reverts if staking more than balance', async () => {
          const balance = await stakingToken.balanceOf(user1.address);
          await expect(
            contract.connect(user1).stake(balance.add(1), scoreProof1),
          ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
        });

        it(`reverts if the user's cooldown timestamp is > 0`, async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          await contract.connect(user1).startExitCooldown();

          await expect(
            contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1),
          ).to.be.revertedWith(
            'StakingAccrualERC20V5: cannot stake during cooldown period',
          );
        });

        it('stakes the staking token and mints an equal amount of stARCx, with a proof', async () => {
          expect(await contract.balanceOf(user1.address)).to.eq(0);

          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          expect(await contract.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
        });

        it('withdraws from the sablier stream', async () => {
          expect(await stakingToken.balanceOf(contract.address)).to.eq(0);

          // Setup sablier stream by the admin to the starcx contract
          await sablierContract.setCurrentTimestamp(0);
          await createStream(
            sablierContract,
            stakingToken,
            contract,
            STAKE_AMOUNT,
            STREAM_DURATION,
            true,
          );

          await sablierContract.setCurrentTimestamp(1);
          expect(await stakingToken.balanceOf(contract.address)).to.eq(0);
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          expect(await stakingToken.balanceOf(contract.address)).to.eq(
            STAKE_AMOUNT.add(STAKE_AMOUNT.div(10)),
          );
        });
      });

      describe('#startExitCooldown', () => {
        it('reverts if user has 0 balance', async () => {
          await expect(
            contract.connect(user1).startExitCooldown(),
          ).to.be.revertedWith('StakingAccrualERC20V5: user has 0 balance');
        });

        it('starts the exit cooldown', async () => {
          let cooldownTimestamp = await contract.cooldowns(user1.address);
          expect(cooldownTimestamp).to.eq(0);

          await contract.setCurrentTimestamp(10);
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          await contract.connect(user1).startExitCooldown();

          cooldownTimestamp = await contract.cooldowns(user1.address);
          expect(cooldownTimestamp).to.eq(COOLDOWN_DURATION + 10);
        });

        it('reverts if the exit cooldown is > 0', async () => {
          await contract.setCurrentTimestamp(10);
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user1).startExitCooldown();

          await expect(
            contract.connect(user1).startExitCooldown(),
          ).to.be.revertedWith(
            'StakingAccrualERC20V5: exit cooldown already started',
          );
        });
      });

      describe('#exit', () => {
        it('reverts if user has 0 balance', async () => {
          expect(await contract.connect(user1).balanceOf(user1.address)).eq(0);
          await expect(contract.connect(user1).exit()).to.be.revertedWith(
            'StakingAccrualERC20V5: user has 0 balance',
          );
        });

        it('reverts if the cooldown timestamp is not passed', async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user1).startExitCooldown();

          await expect(contract.connect(user1).exit()).to.be.revertedWith(
            'StakingAccrualERC20V5: exit cooldown not elapsed',
          );
        });

        it('reverts if the startExitCooldown was not initiated', async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          await expect(contract.connect(user1).exit()).to.be.revertedWith(
            'StakingAccrualERC20V5: exit cooldown was not initiated',
          );
        });

        /**
         * It reduces the user's balance to 0, burns the respective stARCx amount
         * from the user and returns the original ARCx balance
         */
        it(`exits from the fund`, async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user1).startExitCooldown();

          await waitCooldown(contract, COOLDOWN_DURATION);

          let cooldownTimestamp = await contract.cooldowns(user1.address);
          expect(cooldownTimestamp).to.eq(COOLDOWN_DURATION);
          expect(await contract.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.sub(STAKE_AMOUNT),
          );
          await contract.connect(user1).exit();

          cooldownTimestamp = await contract.cooldowns(user1.address);
          expect(cooldownTimestamp).to.eq(0);
          expect(await contract.balanceOf(user1.address)).to.eq(0);
          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE,
          );
        });

        it('withdraws from the sablier stream', async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user1).startExitCooldown();

          await waitCooldown(contract, COOLDOWN_DURATION);

          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.sub(STAKE_AMOUNT),
          );

          // Setup sablier stream by the admin to the starcx contract
          await sablierContract.setCurrentTimestamp(0);
          await createStream(
            sablierContract,
            stakingToken,
            contract,
            STAKE_AMOUNT,
            STREAM_DURATION,
            true,
          );

          await sablierContract.setCurrentTimestamp(1);
          await contract.connect(user1).exit();

          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.add(STAKE_AMOUNT.div(10)),
          );
        });

        it('exits with MORE ARCx than initially if the contract has accumulated more tokens', async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user2).stake(STAKE_AMOUNT, scoreProof2);

          await contract.connect(user1).startExitCooldown();
          await waitCooldown(contract, COOLDOWN_DURATION);

          await stakingToken.mintShare(contract.address, STAKE_AMOUNT);

          await contract.connect(user1).exit();

          expect(await contract.balanceOf(user1.address)).to.eq(0);
          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.add(STAKE_AMOUNT.div('2')),
          );
        });

        it('exits with LESS ARCx than initially if the admin had removed tokens', async () => {
          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);
          await contract.connect(user2).stake(STAKE_AMOUNT, scoreProof2);

          await contract.connect(user1).startExitCooldown();
          await waitCooldown(contract, COOLDOWN_DURATION);

          await contract.recoverTokens(STAKE_AMOUNT);

          await contract.connect(user1).exit();

          expect(await contract.balanceOf(user1.address)).to.eq(0);
          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.sub(STAKE_AMOUNT.div(2)),
          );
        });

        it('exits at the end of the sablier stream', async () => {
          await sablierContract.setCurrentTimestamp(0);
          await contract.setCurrentTimestamp(0);

          await createStream(
            sablierContract,
            stakingToken,
            contract,
            STAKE_AMOUNT,
            STREAM_DURATION,
            true,
          );

          await sablierContract.setCurrentTimestamp(1);

          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          await contract.connect(user1).startExitCooldown();

          await sablierContract.setCurrentTimestamp(COOLDOWN_DURATION);
          await contract.setCurrentTimestamp(COOLDOWN_DURATION);

          await contract.claimStreamFunds();

          await contract.connect(user1).exit();

          expect(await stakingToken.balanceOf(user1.address)).to.eq(
            INITIAL_BALANCE.add(STAKE_AMOUNT),
          );
        });
      });

      describe('#getExchangeRate', () => {
        it('updates total supply and exchange rate depends on staking and minting shares', async () => {
          expect(await contract.toStakingToken(200)).to.eq(0);
          expect(await contract.toStakedToken(100)).to.eq(0);
          expect(await contract.getExchangeRate()).to.eq(0);
          expect(await contract.totalSupply()).to.eq(0);

          await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

          expect(await contract.getExchangeRate()).to.eq(utils.parseEther('1'));
          expect(await contract.totalSupply()).to.eq(STAKE_AMOUNT);

          await contract.connect(user2).stake(STAKE_AMOUNT, scoreProof2);

          expect(await contract.getExchangeRate()).to.eq(utils.parseEther('1'));
          expect(await contract.totalSupply()).to.eq(STAKE_AMOUNT.mul(2));

          await stakingToken.mintShare(contract.address, STAKE_AMOUNT);

          expect(await contract.getExchangeRate()).to.eq(
            utils.parseEther('1.5'),
          );
          expect(await contract.totalSupply()).to.eq(STAKE_AMOUNT.mul(2));
        });
      });
    });

    describe('Scenarios', () => {
      async function checkState(
        exchangeRate: string,
        shareTotalSupply: string,
        balanceOfStarcx: string,
      ) {
        expect(await contract.getExchangeRate()).to.eq(
          utils.parseEther(exchangeRate),
          'getExchangeRate',
        );
        expect(await contract.totalSupply()).to.eq(
          utils.parseEther(shareTotalSupply),
          'totalSupply',
        );
        expect(await stakingToken.balanceOf(contract.address)).to.eq(
          utils.parseEther(balanceOfStarcx),
          'balance of starcx contract',
        );
      }

      it('Two players with admin', async () => {
        await checkState('0', '0', '0');

        await contract
          .connect(user1)
          .stake(utils.parseEther('100'), scoreProof1);

        await checkState('1', '100', '100');

        await contract
          .connect(user2)
          .stake(utils.parseEther('200'), scoreProof2);

        await checkState('1', '300', '300');

        await stakingToken.mintShare(contract.address, utils.parseEther('300'));

        await checkState('2', '300', '600');

        await stakingToken.mintShare(contract.address, utils.parseEther('300'));

        await checkState('3', '300', '900');

        await contract.recoverTokens(utils.parseEther('450'));

        await checkState('1.5', '300', '450');

        await checkUserBalance(contract, user1);
      });

      it('Two players without admin', async () => {
        await checkState('0', '0', '0');

        await contract
          .connect(user1)
          .stake(utils.parseEther('100'), scoreProof1);

        await checkState('1', '100', '100');

        await contract
          .connect(user2)
          .stake(utils.parseEther('200'), scoreProof2);

        await checkState('1', '300', '300');

        await contract
          .connect(user1)
          .stake(utils.parseEther('200'), scoreProof1);

        await checkState('1', '500', '500');

        await checkUserBalance(contract, user1);

        await contract.connect(user1).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user1).exit();

        await checkState('1', '200', '200');

        await contract.connect(user2).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user2).exit();

        await checkState('0', '0', '0');
      });

      it('Complex scenario', async () => {
        await checkState('0', '0', '0');

        await contract
          .connect(user1)
          .stake(utils.parseEther('100'), scoreProof1);

        await checkState('1', '100', '100');

        await contract
          .connect(user2)
          .stake(utils.parseEther('200'), scoreProof2);

        await checkState('1', '300', '300');
        await checkUserBalance(contract, user1);
        await checkUserBalance(contract, user2);

        await contract
          .connect(user2)
          .stake(utils.parseEther('50'), scoreProof2);

        await checkState('1', '350', '350');

        await stakingToken.mintShare(contract.address, utils.parseEther('350'));

        await checkState('2', '350', '700');
        await checkUserBalance(contract, user1);
        await checkUserBalance(contract, user2);

        await contract.connect(user2).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user2).exit();

        await checkState('2', '100', '200');

        await stakingToken.mintShare(contract.address, utils.parseEther('50'));

        await checkState('2.5', '100', '250');

        await contract.connect(user1).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user1).exit();

        await checkState('0', '0', '0');

        await stakingToken.mintShare(contract.address, utils.parseEther('200'));

        await checkState('0', '0', '200');

        await contract
          .connect(user1)
          .stake(utils.parseEther('50'), scoreProof1);

        await checkState('1', '250', '250');

        await stakingToken.mintShare(contract.address, utils.parseEther('125'));

        await checkState('1.5', '250', '375');

        await contract
          .connect(user2)
          .stake(utils.parseEther('150'), scoreProof2);

        await checkState('1.5', '350', '525');

        await stakingToken.mintShare(contract.address, utils.parseEther('175'));

        await checkState('2', '350', '700');

        await contract.connect(user1).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user1).exit();

        await checkState('2', '100', '200');

        await contract.recoverTokens(utils.parseEther('50'));

        await checkState('1.5', '100', '150');

        await contract.connect(user2).startExitCooldown();
        await waitCooldown(contract, COOLDOWN_DURATION);
        await contract.connect(user2).exit();

        await checkState('0', '0', '0');
      });
    });
  });

  describe('Upgrade specific tests', () => {
    let upgradedContract: StakingAccrualERC20V5;

    before(async () => {
      const baseContract = await _baseContractSetup();

      // Have two users stake on the base contract
      await approve(
        STAKE_AMOUNT.mul(2),
        stakingToken.address,
        baseContract.address,
        user1,
      );
      await approve(
        STAKE_AMOUNT.mul(2),
        stakingToken.address,
        baseContract.address,
        user2,
      );
      await baseContract.connect(user1).stake(STAKE_AMOUNT);
      await baseContract.connect(user2).stake(STAKE_AMOUNT);
      // Top up contract to simulate added rewards
      await stakingToken.mintShare(baseContract.address, STAKE_AMOUNT);

      // Upgrade contract
      const v4Impl = await new MockStakingAccrualERC20V5Factory(admin).deploy();
      const proxy = ArcProxyFactory.connect(baseContract.address, admin);
      await proxy.upgradeTo(v4Impl.address);
      upgradedContract = MockStakingAccrualERC20V5Factory.connect(
        proxy.address,
        admin,
      );
    });

    describe('Upgradability', () => {
      it('ensures starcx balances are unchanged', async () => {
        expect(await upgradedContract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT,
        );
        expect(await upgradedContract.balanceOf(user2.address)).to.eq(
          STAKE_AMOUNT,
        );
      });

      it('ensures users can exit', async () => {
        const remainingAmt = INITIAL_BALANCE.sub(STAKE_AMOUNT);
        // We are adding an extra STAKE_AMOUNT on top of what's staked to simulate
        // rewards flowing into the contract. For this reason, the users end up with an
        // additional STAKE_AMOUNT/2 in their wallet after exit.
        const expectedExitAmt = INITIAL_BALANCE.add(STAKE_AMOUNT.div(2));

        expect(await stakingToken.balanceOf(user1.address)).to.eq(remainingAmt);
        expect(await stakingToken.balanceOf(user2.address)).to.eq(remainingAmt);

        await upgradedContract.connect(user1).startExitCooldown();
        await upgradedContract.setCurrentTimestamp(COOLDOWN_DURATION + 1);
        await upgradedContract.connect(user1).exit();
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          expectedExitAmt,
        );

        await upgradedContract.connect(user2).startExitCooldown();
        await upgradedContract.setCurrentTimestamp(COOLDOWN_DURATION * 2 + 1);
        await upgradedContract.connect(user2).exit();
        expect(await stakingToken.balanceOf(user2.address)).to.eq(
          expectedExitAmt,
        );
      });
    });

    describe('#stake', () => {
      beforeEach(async () => {
        await upgradedContract.setPassportScoresContract(
          passportScores.address,
        );

        expect(await upgradedContract.passportScoresContract()).to.eq(
          passportScores.address,
        );

        await upgradedContract.setProofProtocol(
          utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
        );
        await upgradedContract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD);
      });

      it('reverts if proof is set and no proof is provided', async () => {
        expect(await upgradedContract.getProofProtocol()).to.eq(
          DEFAULT_PROOF_PROTOCOL,
        );
        expect(await upgradedContract.scoreThreshold()).to.eq(
          DEFAULT_SCORE_THRESHOLD,
        );

        await expect(
          upgradedContract.stake(
            STAKE_AMOUNT,
            getEmptyScoreProof(
              user1.address,
              utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
            ),
          ),
        ).to.be.revertedWith(
          'PassportScoreVerifiable: proof does not belong to the caller',
        );
      });

      it('reverts if proof is set and the wrong proof is passed', async () => {
        await expect(
          upgradedContract.connect(user1).stake(STAKE_AMOUNT, scoreProof2),
        ).to.be.revertedWith(
          'PassportScoreVerifiable: proof does not belong to the caller',
        );
      });

      it('reverts if proof is set and the score is smaller than the threshold', async () => {
        await upgradedContract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD + 1);
        await expect(
          upgradedContract.connect(user1).stake(STAKE_AMOUNT, scoreProof1),
        ).to.be.revertedWith('StakingAccrualERC20V5: score is below threshold');
      });

      it('stakes if proof is set and score is greater than or equal to the threshold', async () => {
        expect(await upgradedContract.getProofProtocol()).to.eq(
          DEFAULT_PROOF_PROTOCOL,
        );
        expect(await upgradedContract.scoreThreshold()).to.eq(
          DEFAULT_SCORE_THRESHOLD,
        );

        expect(await upgradedContract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT,
        );

        await upgradedContract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

        const totalShares = await upgradedContract.totalSupply();
        const totalStakingToken = await stakingToken.balanceOf(
          upgradedContract.address,
        );
        expect(await upgradedContract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.add(
            STAKE_AMOUNT.mul(totalShares).div(totalStakingToken),
          ),
        );
      });

      it('stakes if no proof is passed', async () => {
        await upgradedContract.setProofProtocol(constants.HashZero);

        expect(await upgradedContract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT,
        );

        await upgradedContract
          .connect(user1)
          .stake(STAKE_AMOUNT, getEmptyScoreProof(user1.address));

        const totalShares = await upgradedContract.totalSupply();
        const totalStakingToken = await stakingToken.balanceOf(
          upgradedContract.address,
        );
        expect(await upgradedContract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.add(
            STAKE_AMOUNT.mul(totalShares).div(totalStakingToken),
          ),
        );
      });
    });

    describe('#setProofProtocol', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          upgradedContract
            .connect(user1)
            .setProofProtocol(utils.formatBytes32String('')),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the proof protocol', async () => {
        expect(await upgradedContract.getProofProtocol()).to.eq('');

        await upgradedContract.setProofProtocol(
          utils.formatBytes32String('test'),
        );

        expect(await upgradedContract.getProofProtocol()).to.eq('test');
      });
    });

    describe('#setScoreThreshold', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          upgradedContract.connect(user1).setScoreThreshold(21),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the score threshold', async () => {
        expect(await upgradedContract.scoreThreshold()).to.eq(0);

        await upgradedContract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD);

        expect(await upgradedContract.scoreThreshold()).to.eq(
          DEFAULT_SCORE_THRESHOLD,
        );
      });
    });

    describe('#setPassportScoresContract', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          upgradedContract
            .connect(user1)
            .setPassportScoresContract(upgradedContract.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the passport scores contract', async () => {
        expect(await upgradedContract.passportScoresContract()).to.eq(
          constants.AddressZero,
        );

        await upgradedContract.setPassportScoresContract(
          passportScores.address,
        );

        expect(await upgradedContract.passportScoresContract()).to.eq(
          passportScores.address,
        );
      });
    });
  });
});
