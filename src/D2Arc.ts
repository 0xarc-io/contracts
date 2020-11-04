import { Signer, Wallet } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import {
  D2CoreV1,
  IERC20,
  IOracle,
  ISyntheticToken,
  SyntheticToken,
  TransactionOverrides,
} from './typings';
import { ID2Core } from './typings/ID2Core';
import { asyncForEach } from '@src/utils/asyncForEach';
import { TestToken } from '@src/typings/TestToken';
import { ActionOperated, Operation, Position } from './types';
import { parseLogs } from './utils/parseLogs';
import { calculateLiquidationAmount } from './utils/calculations';

export enum SynthNames {
  TESTUSD = 'TESTUSD',
}

export type Synth = {
  core: D2CoreV1;
  oracle: IOracle;
  collateral: TestToken;
  synthetic: SyntheticToken;
};

export default class D2Arc {
  public signer: Signer;
  public signerAddress: string;

  public synths: { [name: string]: Synth } = {};

  static async init(signer: Signer): Promise<D2Arc> {
    let arc = new D2Arc();
    arc.signer = signer;
    arc.signerAddress = await signer.getAddress();
    return arc;
  }

  public async addSynths(synths: { [name in SynthNames]: string }) {
    const entries = Object.entries(synths);
    await asyncForEach(entries, async ([name, synth]) => {
      const core = D2CoreV1.at(this.signer, synth);
      const oracle = IOracle.at(this.signer, await core.getCurrentOracle());
      const collateral = TestToken.at(this.signer, await core.getCollateralAsset());
      const synthetic = SyntheticToken.at(this.signer, await core.getSyntheticAsset());

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
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    const tx = await contract.operateAction(
      Operation.Open,
      {
        id: 0,
        amountOne: collateralAmount,
        amountTwo: borrowAmount,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async borrow(
    positionId: BigNumberish,
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    const tx = await contract.operateAction(
      Operation.Borrow,
      {
        id: positionId,
        amountOne: collateralAmount,
        amountTwo: borrowAmount,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async repay(
    positionId: BigNumberish,
    repaymentAmount: BigNumberish,
    withdrawAmount: BigNumberish,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    const tx = await contract.operateAction(
      Operation.Repay,
      {
        id: positionId,
        amountOne: repaymentAmount,
        amountTwo: withdrawAmount,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async liquidatePosition(
    positionId: BigNumberish,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    const tx = await contract.operateAction(
      Operation.Liquidate,
      {
        id: positionId,
        amountOne: 0,
        amountTwo: 0,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async getLiquidationDetails(position: Position, synth: Synth = this.availableSynths()[0]) {
    const currentPrice = await (await synth.oracle.fetchCurrentPrice()).value;
    const fees = await await synth.core.getFees();
    const collateralRatio = await (await synth.core.getCollateralRatio()).value;
    const borrowIndex = await synth.core.getBorrowIndex();

    return calculateLiquidationAmount(
      position.collateralAmount.value,
      new BigNumber(position.borrowedAmount.value).bigMul(borrowIndex[0]),
      currentPrice,
      fees._liquidationUserFee.value,
      collateralRatio,
      fees._liquidationArcRatio.value,
    );
  }

  async parseActionTx(tx: any) {
    const receipt = await tx.wait();
    const logs = parseLogs(receipt.logs, D2CoreV1.ABI);
    const log = logs[0];

    const position = {
      owner: log.values.updatedPosition[0],
      collateralAmount: {
        sign: log.values.updatedPosition[1][0],
        value: log.values.updatedPosition[1][1],
      },
      borrowedAmount: {
        sign: log.values.updatedPosition[2][0],
        value: log.values.updatedPosition[2][1],
      },
    } as Position;

    const result = {
      operation: log.values.operation,
      params: {
        id: log.values.params[0],
        amountOne: log.values.params[1],
        amountTwo: log.values.params[2],
      },
      updatedPosition: position,
    } as ActionOperated;

    return result;
  }

  async getCore(synth: Synth, caller?: Signer) {
    return await D2CoreV1.at(caller || this.signer, synth.core.address);
  }
}
