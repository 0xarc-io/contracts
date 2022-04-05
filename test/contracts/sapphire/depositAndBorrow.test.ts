import { SapphireTestArc } from '@src/SapphireTestArc';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { BigNumber, constants, Signer, utils } from 'ethers';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_PRICE,
  DEFAULT_STABLECOIN_DECIMALS,
  DEFAULT_STABLE_COIN_PRECISION_SCALAR,
} from '@test/helpers/sapphireDefaults';
import {
  CREDIT_PROOF_PROTOCOL,
  BORROW_LIMIT_PROOF_PROTOCOL,
} from '@src/constants';
import { mintApprovedCollateral } from '@test/helpers/setupBaseVault';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import { getEmptyScoreProof, getScoreProof } from '@src/utils/getScoreProof';
import {
  PassportScore,
  PassportScoreProof,
  Vault,
} from '@arc-types/sapphireCore';
import { PassportScoreTree } from '@src/MerkleTree';
import { TestToken } from '@src/typings';
import { TransactionOverrides } from '@arc-types/ethereum';

chai.use(solidity);

/**
 * When calling depositAndBorrow(), it's calling executeActions underneath the hood with borrow and deposit actions.
 * Because borrow is called first time it creates a position for sender, which is connected directly with his address.
 * The two scenarios to test here are for with a valid score proof and one without a valid score proof.
 * You only need a score proof if your address has a store proof in the CreditScore contract.
 */
describe('SapphireCore.depositAndBorrow()', () => {
  const COLLATERAL_AMOUNT = utils.parseUnits(
    '100',
    DEFAULT_COLLATERAL_DECIMALS,
  );
  const BORROW_AMOUNT = utils
    .parseUnits('50', DEFAULT_STABLECOIN_DECIMALS)
    .mul(DEFAULT_PRICE)
    .div(BASE);
  const SCALED_BORROW_AMOUNT = BORROW_AMOUNT.mul(
    DEFAULT_STABLE_COIN_PRECISION_SCALAR,
  );

  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: PassportScore;
  let creditScore2: PassportScore;
  let borrowLimitScore1: PassportScore;
  let borrowLimitScore2: PassportScore;
  let minterBorrowLimitScore: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let stableCoin: TestToken;

  async function depositAndBorrowAndGetVault(
    collateralAmount: BigNumber,
    borrowAmount: BigNumber,
    borrowAssetAddress: string,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    minterBorrowLimitScore: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
    ),
    coreName: string = arc.getCoreNames()[0],
    caller: Signer = arc.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    await arc.depositAndBorrow(
      collateralAmount,
      borrowAmount,
      borrowAssetAddress,
      passportScoreProof,
      minterBorrowLimitScore,
      coreName,
      caller,
      overrides,
    );

    return arc.getVault(await caller.getAddress());
  }

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(20),
    };
    borrowLimitScore1 = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };
    borrowLimitScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };
    minterBorrowLimitScore = {
      account: ctx.signers.borrower.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };
    creditScoreTree = new PassportScoreTree([
      creditScore1,
      creditScore2,
      borrowLimitScore1,
      borrowLimitScore2,
      minterBorrowLimitScore,
    ]);
    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      poolDepositBorrowAmount: SCALED_BORROW_AMOUNT.mul(3),
    });

    await mintApprovedCollateral(
      ctx.sdks.sapphire,
      ctx.signers.borrower,
      COLLATERAL_AMOUNT.mul(2),
    );
    await mintApprovedCollateral(
      ctx.sdks.sapphire,
      ctx.signers.scoredBorrower,
      COLLATERAL_AMOUNT.mul(2),
    );
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    stableCoin = ctx.contracts.stablecoin;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('without score proof', () => {
    it('depositAndBorrow at the exact c-ratio', async () => {
      const vault = await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        stableCoin.address,
        undefined,
        getScoreProof(minterBorrowLimitScore, creditScoreTree),
        undefined,
        ctx.signers.borrower,
      );

      // Ensure the function returned correct information
      expect(vault.normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
      expect(vault.principal).eq(SCALED_BORROW_AMOUNT);
      expect(vault.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().normalizedTotalBorrowed()).eq(
        SCALED_BORROW_AMOUNT,
      );

      expect(
        await arc.coreContracts().collateral.balanceOf(arc.coreAddress()),
      ).eq(COLLATERAL_AMOUNT);
    });

    it('depositAndBorrow above the c-ratio', async () => {
      const {
        normalizedBorrowedAmount,
        collateralAmount,
        principal,
      } = await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        stableCoin.address,
        undefined,
        getScoreProof(minterBorrowLimitScore, creditScoreTree),
        undefined,
        ctx.signers.borrower,
      );

      expect(collateralAmount).eq(COLLATERAL_AMOUNT.mul(2));
      expect(principal).eq(SCALED_BORROW_AMOUNT);
      expect(normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
    });

    it('revert if depositAndBorrowed below the c-ratio', async () => {
      const change = utils.parseUnits('1', DEFAULT_COLLATERAL_DECIMALS);
      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.add(change),
          stableCoin.address,
          undefined,
          getScoreProof(minterBorrowLimitScore, creditScoreTree),
          undefined,
          ctx.signers.borrower,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );

      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT.sub(change),
          BORROW_AMOUNT,
          stableCoin.address,
          undefined,
          getScoreProof(minterBorrowLimitScore, creditScoreTree),
          undefined,
          ctx.signers.borrower,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );
    });

    it('revert if depositAndBorrowed below the minimum position amount', async () => {
      await arc
        .core()
        .setLimits(
          SCALED_BORROW_AMOUNT.add(10),
          SCALED_BORROW_AMOUNT.add(100),
          0,
        );

      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          stableCoin.address,
          undefined,
          getScoreProof(minterBorrowLimitScore, creditScoreTree),
          undefined,
          ctx.signers.borrower,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be less than limit',
      );
    });

    it('revert if depositAndBorrowed above the maximum borrowed amount', async () => {
      await arc
        .core()
        .setLimits(
          SCALED_BORROW_AMOUNT.sub(100),
          SCALED_BORROW_AMOUNT.sub(1),
          0,
        );
      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          stableCoin.address,
          undefined,
          getScoreProof(minterBorrowLimitScore, creditScoreTree),
          undefined,
          ctx.signers.borrower,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be greater than vault limit',
      );
    });
  });

  describe('with score proof', () => {
    let creditScoreProof: PassportScoreProof;
    let scoredMinter: SignerWithAddress;
    before(() => {
      creditScoreProof = getScoreProof(creditScore1, creditScoreTree);
      scoredMinter = ctx.signers.scoredBorrower;
    });

    it('depositAndBorrow at the exact default c-ratio', async () => {
      const {
        normalizedBorrowedAmount,
        collateralAmount,
        principal,
      } = await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        scoredMinter,
      );

      // Check created vault
      expect(normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
      expect(principal).eq(SCALED_BORROW_AMOUNT);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().normalizedTotalBorrowed()).eq(
        SCALED_BORROW_AMOUNT,
      );

      expect(
        await arc.coreContracts().collateral.balanceOf(arc.coreAddress()),
      ).eq(COLLATERAL_AMOUNT);
    });

    it('depositAndBorrow above the default c-ratio', async () => {
      await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        scoredMinter,
      );

      const {
        normalizedBorrowedAmount,
        collateralAmount,
        principal,
      } = await arc.getVault(scoredMinter.address);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT.mul(2));
      expect(principal).eq(SCALED_BORROW_AMOUNT);
      expect(normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
    });

    it('depositAndBorrow below the default c-ratio, but above c-ratio based on credit score', async () => {
      await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT.sub(1),
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        scoredMinter,
      );

      const {
        normalizedBorrowedAmount,
        collateralAmount,
        principal,
      } = await arc.getVault(scoredMinter.address);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT.sub(1));
      expect(normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
      expect(principal).eq(SCALED_BORROW_AMOUNT);
    });

    it('depositAndBorrow at the c-ratio based on credit score', async () => {
      //  defaultBorrow * 2 = defaultCollateral
      // 2 => 3/2
      // maxBorrow = defaultCollateral / (3/2)
      // maxBorrow = 2 * 2 * defaultBorrow / 3
      // maxBorrow = 4/3 * defaultBorrow
      const MAX_BORROW_AMOUNT = BORROW_AMOUNT.mul(4).div(3);

      await depositAndBorrowAndGetVault(
        COLLATERAL_AMOUNT,
        MAX_BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        scoredMinter,
      );

      const {
        normalizedBorrowedAmount,
        collateralAmount,
        principal,
      } = await arc.getVault(scoredMinter.address);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);
      expect(normalizedBorrowedAmount).eq(
        MAX_BORROW_AMOUNT.mul(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      );
      expect(principal).eq(
        MAX_BORROW_AMOUNT.mul(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      );
    });

    it('revert if depositAndBorrowed below c-ratio based on credit score', async () => {
      await expect(
        depositAndBorrowAndGetVault(
          constants.One,
          BORROW_AMOUNT,
          stableCoin.address,
          creditScoreProof,
          getScoreProof(borrowLimitScore1, creditScoreTree),
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );
    });

    it('revert if depositAndBorrowed below the minimum position amount', async () => {
      await arc
        .core()
        .setLimits(
          SCALED_BORROW_AMOUNT.add(10),
          SCALED_BORROW_AMOUNT.add(100),
          0,
        );
      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          stableCoin.address,
          creditScoreProof,
          getScoreProof(borrowLimitScore1, creditScoreTree),
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be less than limit',
      );
    });

    it('revert if depositAndBorrowed above the maximum borrowed amount', async () => {
      await arc
        .core()
        .setLimits(
          SCALED_BORROW_AMOUNT.sub(100),
          SCALED_BORROW_AMOUNT.sub(1),
          0,
        );
      await expect(
        depositAndBorrowAndGetVault(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          stableCoin.address,
          creditScoreProof,
          getScoreProof(borrowLimitScore1, creditScoreTree),
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be greater than vault limit',
      );
    });
  });
});
