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
  MockStakingAccrualERC20V4,
  MockStakingAccrualERC20V4Factory,
  StakingAccrualERC20,
  StakingAccrualERC20Factory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
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

const COOLDOWN_DURATION = 60;
const DEFAULT_SCORE_THRESHOLD = 500;
const STAKE_AMOUNT = utils.parseEther('100');
const INITIAL_BALANCE = STAKE_AMOUNT.mul('10');

describe('StakingAccrualERC20V4', () => {
  let contract: MockStakingAccrualERC20V4;

  let stakingToken: TestToken;
  let tree: PassportScoreTree;
  let passportScores: MockSapphirePassportScores;
  let sablierContract: MockSablier;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let scoreProof1: PassportScoreProof;
  let scoreProof2: PassportScoreProof;

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

  async function init(ctx: ITestContext) {
    admin = ctx.signers.admin;
    user1 = ctx.signers.scoredMinter;
    user2 = ctx.signers.staker;

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
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Base functionality tests', () => {
    describe('Admin functions', () => {
      let uninitializedContract: MockStakingAccrualERC20V4;

      before(async () => {
        const uninitializedContractImpl = await new MockStakingAccrualERC20V4Factory(
          admin,
        ).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          uninitializedContractImpl.address,
          admin.address,
          [],
        );
        uninitializedContract = MockStakingAccrualERC20V4Factory.connect(
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
            'StakingAccrualERC20V4: staking token is not a contract',
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
            'StakingAccrualERC20V4: staking token is not a contract',
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
    });
  });

  describe('Upgrade specific tests', () => {
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
      beforeEach(async () => {
        expect(await contract.passportScoresContract()).to.eq(
          passportScores.address,
        );

        await contract.setProofProtocol(
          utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
        );
        await contract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD);
      });

      it('reverts if proof is set and no proof is provided', async () => {
        expect(await contract.getProofProtocol()).to.eq(DEFAULT_PROOF_PROTOCOL);
        expect(await contract.scoreThreshold()).to.eq(DEFAULT_SCORE_THRESHOLD);

        await expect(
          contract.stake(
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
          contract.connect(user1).stake(STAKE_AMOUNT, scoreProof2),
        ).to.be.revertedWith(
          'PassportScoreVerifiable: proof does not belong to the caller',
        );
      });

      it('reverts if proof is set and the score is smaller than the threshold', async () => {
        await contract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD + 1);
        await expect(
          contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1),
        ).to.be.revertedWith('StakingAccrualERC20V4: score is below threshold');
      });

      it('stakes if proof is set and score is greater than or equal to the threshold', async () => {
        expect(await contract.getProofProtocol()).to.eq(DEFAULT_PROOF_PROTOCOL);
        expect(await contract.scoreThreshold()).to.eq(DEFAULT_SCORE_THRESHOLD);

        expect(await contract.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);

        await contract.connect(user1).stake(STAKE_AMOUNT, scoreProof1);

        const totalShares = await contract.totalSupply();
        const totalStakingToken = await stakingToken.balanceOf(
          contract.address,
        );
        expect(await contract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.add(
            STAKE_AMOUNT.mul(totalShares).div(totalStakingToken),
          ),
        );
      });

      it('stakes if no proof is passed', async () => {
        await contract.setProofProtocol(constants.HashZero);

        expect(await contract.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);

        await contract
          .connect(user1)
          .stake(STAKE_AMOUNT, getEmptyScoreProof(user1.address));

        const totalShares = await contract.totalSupply();
        const totalStakingToken = await stakingToken.balanceOf(
          contract.address,
        );
        expect(await contract.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.add(
            STAKE_AMOUNT.mul(totalShares).div(totalStakingToken),
          ),
        );
      });
    });

    describe('#setProofProtocol', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          contract
            .connect(user1)
            .setProofProtocol(utils.formatBytes32String('')),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the proof protocol', async () => {
        expect(await contract.getProofProtocol()).to.eq('');

        await contract.setProofProtocol(utils.formatBytes32String('test'));

        expect(await contract.getProofProtocol()).to.eq('test');
      });
    });

    describe('#setScoreThreshold', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          contract.connect(user1).setScoreThreshold(21),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the score threshold', async () => {
        expect(await contract.scoreThreshold()).to.eq(0);

        await contract.setScoreThreshold(DEFAULT_SCORE_THRESHOLD);

        expect(await contract.scoreThreshold()).to.eq(DEFAULT_SCORE_THRESHOLD);
      });
    });

    describe('#setPassportScoresContract', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          contract.connect(user1).setPassportScoresContract(contract.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the passport scores contract', async () => {
        expect(await contract.passportScoresContract()).to.eq(
          passportScores.address,
        );

        await contract.setPassportScoresContract(contract.address);

        expect(await contract.passportScoresContract()).to.eq(contract.address);
      });
    });
  });
});
