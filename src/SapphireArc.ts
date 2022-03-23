import { CoreContracts } from '@arc-types/core';
import { TransactionOverrides } from '@arc-types/ethereum';
import {
  Action,
  Operation,
  PassportScoreProof,
  Vault,
} from '@arc-types/sapphireCore';
import {
  BigNumber,
  constants,
  ContractTransaction,
  Signer,
  utils,
} from 'ethers';
import {
  BORROW_LIMIT_PROOF_PROTOCOL,
  CREDIT_PROOF_PROTOCOL,
} from './constants';
import {
  BaseERC20Factory,
  SapphireAssessorFactory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  SapphirePoolFactory,
} from './typings';
import { IOracleFactory } from './typings/IOracleFactory';
import { getEmptyScoreProof } from './utils/getScoreProof';

export type SapphireCoreContracts = CoreContracts<SapphireCoreV1>;

export class SapphireArc {
  public cores: Record<string, SapphireCoreContracts | undefined> = {};

  constructor(public readonly signer: Signer) {}
  static new(signer: Signer): SapphireArc {
    return new SapphireArc(signer);
  }

  public async addCores(coresDict: Record<string, string | undefined>) {
    const keys = Object.keys(coresDict);
    for (const key of keys) {
      const core = SapphireCoreV1Factory.connect(coresDict[key], this.signer);

      this.cores[key] = {
        core,
        oracle: IOracleFactory.connect(await core.oracle(), this.signer),
        collateral: BaseERC20Factory.connect(
          await core.collateralAsset(),
          this.signer,
        ),
        pool: SapphirePoolFactory.connect(await core.borrowPool(), this.signer),
        assessor: SapphireAssessorFactory.connect(
          await core.assessor(),
          this.signer,
        ),
      };
    }
  }

  getCoreContracts(name: string): SapphireCoreContracts {
    const core = this.cores[name];
    if (!core) {
      throw Error(`Core '${name}' is not found`);
    }
    return core;
  }

  getCoreNames() {
    return Object.keys(this.cores);
  }

  /**
   * Runs deposit and borrow on the given core
   * @returns The transaction
   */
  async depositAndBorrow(
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
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    if (collateralAmount.isZero() && borrowAmount.isZero()) {
      throw new Error('SapphireArc: collateral and borrow amounts cannot be 0');
    }

    const actions: Action[] = [];

    if (!collateralAmount.isZero()) {
      actions.push({
        operation: Operation.Deposit,
        borrowAssetAddress: constants.AddressZero,
        amount: collateralAmount,
        userToLiquidate: constants.AddressZero,
      });
    }

    if (!borrowAmount.isZero()) {
      actions.push({
        operation: Operation.Borrow,
        borrowAssetAddress,
        amount: borrowAmount,
        userToLiquidate: constants.AddressZero,
      });
    }

    return this.executeActions(
      actions,
      passportScoreProof,
      minterBorrowLimitScore,
      coreName,
      caller,
      overrides,
    );
  }

  /**
   * Runs repay and withdraw with full amounts at the given core.
   */
  async exit(
    borrowAssetAddress: string,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName = this.getCoreNames()[0],
    caller = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const core = this._getCore(coreName, caller);

    return core.exit(borrowAssetAddress, [passportScoreProof], overrides);
  }

  async repayAndWithdraw(
    repayAssetAddress: string,
    repayAmount: BigNumber,
    withdrawAmount: BigNumber,
    caller: Signer = this.signer,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    passportBorrowLimitProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    overrides: TransactionOverrides = {},
  ) {
    if (repayAmount.isZero() && withdrawAmount.isZero()) {
      throw new Error('SapphireArc: repay and withdraw amounts cannot be 0');
    }

    const actions: Action[] = [];

    if (!repayAmount.isZero()) {
      actions.push({
        operation: Operation.Repay,
        borrowAssetAddress: repayAssetAddress,
        amount: repayAmount,
        userToLiquidate: constants.AddressZero,
      });
    }

    if (!withdrawAmount.isZero()) {
      actions.push({
        operation: Operation.Withdraw,
        borrowAssetAddress: constants.AddressZero,
        amount: withdrawAmount,
        userToLiquidate: constants.AddressZero,
      });
    }

    return this.executeActions(
      actions,
      passportScoreProof,
      passportBorrowLimitProof,
      coreName,
      caller,
      overrides,
    );
  }

  async liquidate(
    owner: string,
    borrowAssetAddress: string,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      owner,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.liquidate(
      owner,
      borrowAssetAddress,
      [passportScoreProof],
      overrides,
    );
  }

  async executeActions(
    actions: Action[],
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    passportBorrowLimitProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.executeActions(
      actions,
      [passportScoreProof, passportBorrowLimitProof],
      overrides,
    );
  }

  /* ========== Borrow functions ==========*/

  async borrow(
    amount: BigNumber,
    borrowAssetAddress: string,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    borrowLimitProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.borrow(
      amount,
      borrowAssetAddress,
      [passportScoreProof, borrowLimitProof],
      overrides,
    );
  }

  async repay(
    amount: BigNumber,
    borrowAssetAddress: string,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.repay(
      amount,
      borrowAssetAddress,
      [passportScoreProof],
      overrides,
    );
  }

  /* ========== Collateral functions ========== */

  async deposit(
    amount: BigNumber,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.deposit(amount, [passportScoreProof], overrides);
  }

  async withdraw(
    amount: BigNumber,
    passportScoreProof: PassportScoreProof = getEmptyScoreProof(
      undefined,
      utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    ),
    coreName: string = this.getCoreNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(coreName, caller);

    return core.withdraw(amount, [passportScoreProof], overrides);
  }

  getVault(
    userAddress: string,
    corename = this.getCoreNames()[0],
  ): Promise<Vault> {
    const coreContracts = this.getCoreContracts(corename);
    return coreContracts.core.vaults(userAddress);
  }

  private _getCore(coreName: string, caller: Signer): SapphireCoreV1 {
    return this.getCoreContracts(coreName).core.connect(caller);
  }
}
