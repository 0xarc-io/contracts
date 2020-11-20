import { ContractTransaction, Signer } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers';
import { ActionOperated, Operation, Position } from '../arc-types/core';
import { calculateLiquidationAmount } from './utils/calculations';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { asyncForEach } from './utils/asyncForEach';
import { MozartV1 } from '@src/typings/MozartV1';
import { IOracle } from '@src/typings/IOracle';
import { TestToken } from '@src/typings/TestToken';
import { MozartV1Factory } from '@src/typings/MozartV1Factory';
import { IOracleFactory } from '@src/typings/IOracleFactory';
import { SyntheticTokenV1Factory } from '@src/typings/SyntheticTokenV1Factory';
import { TestTokenFactory } from '@src/typings/TestTokenFactory';

import { TransactionOverrides } from '../arc-types/ethereum';
import { AddressZero } from '@ethersproject/constants';
import ArcNumber from './utils/ArcNumber';

export enum SynthNames {
  ETHX = 'ETHX',
}

export type Synth = {
  core: MozartV1;
  oracle: IOracle;
  collateral: TestToken;
  synthetic: SyntheticTokenV1;
};

export class MozartArc {
  public signer: Signer;
  public signerAddress: string;

  public synths: { [name: string]: Synth } = {};

  static async init(signer: Signer): Promise<MozartArc> {
    const arc = new MozartArc();
    arc.signer = signer;
    arc.signerAddress = await signer.getAddress();
    return arc;
  }

  public async addSynths(synths: { [name in SynthNames]: string }) {
    const entries = Object.entries(synths);
    await asyncForEach(entries, async ([name, synth]) => {
      const core = new MozartV1Factory(this.signer).attach(synth);
      const oracle = IOracleFactory.connect(await core.getCurrentOracle(), this.signer);
      const collateral = new TestTokenFactory(this.signer).attach(await core.getCollateralAsset());
      const synthetic = new SyntheticTokenV1Factory(this.signer).attach(
        await core.getSyntheticAsset(),
      );

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
        addressOne: AddressZero,
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
        addressOne: AddressZero,
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
        addressOne: AddressZero,
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
        addressOne: AddressZero,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async transferOwnership(
    positionId: BigNumberish,
    newOwner: string,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    const tx = await contract.operateAction(
      Operation.TransferOwnership,
      {
        id: positionId,
        amountOne: 0,
        amountTwo: 0,
        addressOne: newOwner,
      },
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async setGlobalOperatorStatus(
    operator: string,
    status: boolean,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    return await contract.setGlobalOperatorStatus(operator, status, overrides);
  }

  async setPositionOperatorStatus(
    positionId: BigNumberish,
    operator: string,
    status: boolean,
    caller: Signer = this.signer,
    synth: Synth = this.availableSynths()[0],
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(synth, caller);
    return await contract.setPositionOperatorStatus(positionId, operator, status, overrides);
  }

  async getLiquidationDetails(position: Position, synth: Synth = this.availableSynths()[0]) {
    const currentPrice = await (await synth.oracle.fetchCurrentPrice()).value;
    const fees = await await synth.core.getFees();
    const collateralRatio = await (await synth.core.getCollateralRatio()).value;
    const borrowIndex = await synth.core.getBorrowIndex();

    return calculateLiquidationAmount(
      position.collateralAmount.value,
      ArcNumber.bigMul(BigNumber.from(position.borrowedAmount.value), borrowIndex[0]),
      currentPrice,
      fees._liquidationUserFee.value,
      collateralRatio,
      fees._liquidationArcRatio.value,
    );
  }

  async parseActionTx(tx: ContractTransaction) {
    const receipt = await tx.wait();

    const decodedPosition = {} as ActionOperated;
    receipt.logs.forEach((log) => {
      try {
        const decoded = new MozartV1Factory().interface.decodeEventLog('ActionOperated', log.data);

        Object.entries(decoded).forEach(([key, value]) => {
          decodedPosition[key] = value;
        });
      } catch {}
    });

    const position = {
      owner: decodedPosition.updatedPosition[0],
      collateralAmount: {
        sign: decodedPosition.updatedPosition[1][0],
        value: decodedPosition.updatedPosition[1][1],
      },
      borrowedAmount: {
        sign: decodedPosition.updatedPosition[2][0],
        value: decodedPosition.updatedPosition[2][1],
      },
    } as Position;

    const result = {
      operation: decodedPosition.operation,
      params: {
        id: decodedPosition.params[0],
        amountOne: decodedPosition.params[1],
        amountTwo: decodedPosition.params[2],
      },
      updatedPosition: position,
    } as ActionOperated;

    return result;
  }

  async isCollateralized(positionId: BigNumberish, synth: Synth = this.availableSynths()[0]) {
    const position = await synth.core.getPosition(positionId);
    return await synth.core.isCollateralized(position);
  }

  async getCore(synth: Synth, caller?: Signer) {
    return new MozartV1Factory(caller || this.signer).attach(synth.core.address);
  }
}

export default MozartArc;
