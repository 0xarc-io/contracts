import { Synth } from '@arc-types/core';
import { TransactionOverrides } from '@arc-types/ethereum';
import { Action, CreditScoreProof, Operation, Vault } from '@arc-types/sapphireCore';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import {
  BaseERC20Factory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  SyntheticTokenV1Factory,
} from './typings';
import { IOracleFactory } from './typings/IOracleFactory';

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
        collateral: BaseERC20Factory.connect(await core.collateralAsset(), this.signer),
        synthetic: SyntheticTokenV1Factory.connect(await core.syntheticAsset(), this.signer),
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
      },
    ];

    if (!borrowAmount.isZero()) {
      actions.push({
        operation: Operation.Borrow,
        amount: borrowAmount,
      });
    }

    await this.executeActions(actions, creditScoreProof, synthName, caller, overrides);

    return {
      collateralAmount: collateralAmount,
      borrowedAmount: borrowAmount,
    } as Vault;
  }

  async liquidate(
    owner: string,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    return {} as Vault;
  }

  async executeActions(
    actions: Action[],
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    const core = this._getCore(synthName, caller);

    await core.executeActions(actions, creditScoreProof, overrides);

    const vault = await core.getVault(await caller.getAddress());

    return {
      collateralAmount: vault.collateralAmount,
      borrowedAmount: vault.borrowedAmount,
    } as Vault;
  }

  /* ========== Borrow functions ==========*/

  async borrow(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    return {} as Vault;
  }

  async repay(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    return {} as Vault;
  }

  /* ========== Collateral functions ========== */

  async deposit(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Vault> {
    const core = this._getCore(synthName, caller);

    const tx = await core.deposit(
      amount,
      creditScoreProof ?? (await this._getEmptyProof(caller)),
      overrides,
    );
    await tx.wait();

    return core.getVault(await caller.getAddress());
  }

  async withdraw(
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
  ): Promise<Vault> {
    return {} as Vault;
  }

  private _getCore(synthName: string, caller: Signer): SapphireCoreV1 {
    const synth = this.getSynth(synthName);
    return SapphireCoreV1Factory.connect(synth.core.address, caller);
  }

  private async _getEmptyProof(caller: Signer): Promise<CreditScoreProof> {
    return {
      account: await caller.getAddress(),
      score: BigNumber.from(0),
      merkleProof: [],
    };
  }
}
