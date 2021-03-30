import { Synth } from '@arc-types/core';
import { TransactionOverrides } from '@arc-types/ethereum';
import { Action, CreditScoreProof, Position } from '@arc-types/sapphireCore';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import { SapphireCoreV1 } from './typings';

export type SapphireSynth = Synth<SapphireCoreV1>;

export class SapphireArc {
  public synths: Record<string, SapphireSynth | undefined> = {};

  constructor(public readonly signer: Signer) {}
  static new(signer: Signer): SapphireArc {
    return new SapphireArc(signer);
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

  async open(
    collateralAmount: BigNumberish,
    borrowAmount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  async liquidate(
    owner: string,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  async executeActions(
    actions: Action[],
    owner: string,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  /* ========== Borrow functions ==========*/

  async borrow(
    owner: string,
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  async repay(
    owner: string,
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  /* ========== Collateral functions ========== */

  async deposit(
    owner: string,
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ): Promise<Position> {
    return {} as Position;
  }

  async withdraw(
    owner: string,
    amount: BigNumber,
    creditScoreProof?: CreditScoreProof,
    synthName: string = this.getSynthNames()[0],
    caller: Signer = this.signer,
  ): Promise<Position> {
    return {} as Position;
  }
}
