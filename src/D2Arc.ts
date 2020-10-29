import { Signer } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { D2CoreV1, IERC20, IOracle, ISyntheticToken, TransactionOverrides } from './typings';
import { ID2Core } from './typings/ID2Core';
import { asyncForEach } from '@src/utils/asyncForEach';

export enum SynthNames {
  TESTUSD = 'TESTUSD',
}

export type Synth = {
  core: D2CoreV1;
  oracle: IOracle;
  collateral: IERC20;
  synthetic: ISyntheticToken;
};

export default class D2Arc {
  public wallet: Signer;
  public walletAddress: string;

  public synths: { [name: string]: Synth } = {};

  static async init(wallet: Signer): Promise<D2Arc> {
    let arc = new D2Arc();
    arc.wallet = wallet;
    arc.walletAddress = await wallet.getAddress();
    return arc;
  }

  public async addSynths(synths: { [name in SynthNames]: string }) {
    const entries = Object.entries(synths);
    await asyncForEach(entries, async ([name, synth]) => {
      const core = D2CoreV1.at(this.wallet, synth);
      const oracle = IOracle.at(this.wallet, await core.getCurrentOracle());
      const collateral = IERC20.at(this.wallet, await core.getCollateralAsset());
      const synthetic = ISyntheticToken.at(this.wallet, await core.getSyntheticAsset());

      this.synths[name] = {
        core,
        oracle,
        collateral,
        synthetic,
      };
    });
  }

  public availableSynths(): Synth[] {
    return Object.values(this.synths);
  }

  async openPosition(
    collateralAmount: BigNumberish,
    borrowAmount: BigNumber,
    caller: Signer = this.wallet,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {}

  async borrow(
    positionId: BigNumberish,
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller: Signer = this.wallet,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {}

  async repay(
    positionId: BigNumberish,
    repaymentAmount: BigNumberish,
    withdrawAmount: BigNumberish,
    caller: Signer = this.wallet,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {}

  async liquidatePosition(
    positionId: BigNumberish,
    caller: Signer = this.wallet,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {}

  async parseActionTx(tx: any) {}
}
