import { Synth } from '@arc-types/core';
import { TransactionOverrides } from '@arc-types/ethereum';
import {
  Action,
  CreditScoreProof,
  Operation,
  Vault,
} from '@arc-types/sapphireCore';
import {
  BigNumber,
  BigNumberish,
  constants,
  ContractTransaction,
  Signer,
} from 'ethers';
import {
  BaseERC20Factory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  SyntheticTokenV2Factory,
} from './typings';
import { IOracleFactory } from './typings/IOracleFactory';
import { getEmptyScoreProof } from './utils/getScoreProof';

export type SapphireSynth = Synth<SapphireCoreV1>;

export class SapphireArc {
  public synths: Record<string, SapphireSynth | undefined> = {};

  constructor(public readonly signer: Signer) {}
  static new(signer: Signer): SapphireArc {
    return new SapphireArc(signer);
  }

  public async addSynths(synths: Record<string, string | undefined>) {
    const keys = Object.keys(synths);
    for (const key of keys) {
      const core = SapphireCoreV1Factory.connect(synths[key], this.signer);

      this.synths[key] = {
        core,
        oracle: IOracleFactory.connect(await core.oracle(), this.signer),
        collateral: BaseERC20Factory.connect(
          await core.collateralAsset(),
          this.signer,
        ),
        synthetic: SyntheticTokenV2Factory.connect(
          await core.syntheticAsset(),
          this.signer,
        ),
      };
    }
  }

  getSynth(name: string): SapphireSynth {
    const synth = this.synths[name];
    if (!synth) {
      throw Error(`Synth '${name}' is not found`);
    }
    return synth;
  }

  getSynthNames() {
    return Object.keys(this.synths);
  }

  /**
   * Runs deposit and borrow on the given core
   * @returns The new vault
   */
  async open(
    collateralAmount: BigNumberish,
    borrowAmount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    const actions: Action[] = [
      {
        operation: Operation.Deposit,
        amount: collateralAmount,
        userToLiquidate: constants.AddressZero,
      },
    ];

    if (!borrowAmount.isZero()) {
      actions.push({
        operation: Operation.Borrow,
        amount: borrowAmount,
        userToLiquidate: constants.AddressZero,
      });
    }

    return this.executeActions(
      actions,
      creditScoreProof,
      synthName,
      caller,
      overrides,
    );
  }

  /**
   * Runs repay and withdraw with full amounts at the given core.
   */
  async exit(
    creditScoreProof?: CreditScoreProof,
    synthName = this.getSynthNames()[0],
    caller = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const core = this._getCore(synthName, caller);

    return core.exit(
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  async liquidate(
    owner: string,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(synthName, caller);

    return core.liquidate(
      owner,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  async executeActions(
    actions: Action[],
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    const core = this._getCore(synthName, caller);

    await core.executeActions(
      actions,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );

    const vault = await this.getVault(await caller.getAddress());

    return vault;
  }

  /* ========== Borrow functions ==========*/

  async borrow(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(synthName, caller);

    return core.borrow(
      amount,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  async repay(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(synthName, caller);

    return core.repay(
      amount,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  /* ========== Collateral functions ========== */

  async deposit(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(synthName, caller);

    return core.deposit(
      amount,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  async withdraw(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<ContractTransaction> {
    const core = this._getCore(synthName, caller);

    return core.withdraw(
      amount,
      creditScoreProof ?? (await getEmptyScoreProof(caller)),
      overrides,
    );
  }

  getVault(
    userAddress: string,
    synthName = this.getSynthNames()[0],
  ): Promise<Vault> {
    const synth = this.getSynth(synthName);

    return synth.core.getVault(userAddress);
  }

  private _getCore(synthName: string, caller: Signer): SapphireCoreV1 {
    return this.getSynth(synthName).core.connect(caller);
  }
}
