import { Signer } from 'ethers';
import { BigNumberish } from 'ethers';
import { IOracle } from './typings/IOracle';

import {
  Operation,
  OperationParams,
  ActionOperated,
  Position,
  SynthAddressBook,
} from '../arc-types/core';

import Token from './utils/Token';

import { IERC20Factory } from './typings/IERC20Factory';
import { IOracleFactory } from './typings/IOracleFactory';
import { StateV1 } from './typings/StateV1';
import { CoreV4 } from './typings/CoreV4';
import { IERC20 } from './typings/IERC20';

import { RiskParams, MarketParams } from '../arc-types/core';
import { TransactionOverrides } from '../arc-types/ethereum';
import { CoreV4Factory } from './typings/CoreV4Factory';
import { StateV1Factory } from './typings/StateV1Factory';
import { StaticSyntheticTokenFactory } from './typings/StaticSyntheticTokenFactory';

export class SpritzArc {
  public signer: Signer;

  public core: CoreV4;
  public state: StateV1;
  public syntheticAsset: IERC20;
  public collateralAsset: IERC20;
  public oracle: IOracle;

  static async init(signer: Signer, addressBook?: SynthAddressBook): Promise<SpritzArc> {
    const arc = new SpritzArc();
    arc.signer = signer;

    if (addressBook) {
      arc.core = CoreV4Factory.connect(addressBook.proxy, signer);
      arc.state = StateV1Factory.connect(addressBook.state, signer);
      arc.syntheticAsset = StaticSyntheticTokenFactory.connect(addressBook.syntheticToken, signer);
      arc.collateralAsset = IERC20Factory.connect(addressBook.collateralAsset, signer);
      arc.oracle = IOracleFactory.connect(addressBook.oracle, signer);
    }

    return arc;
  }

  async approveStableShare(
    amount: BigNumberish,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const token = IERC20Factory.connect(this.collateralAsset.address, this.signer);

    const existingAllowance = await token.allowance(
      await this.signer.getAddress(),
      this.core.address,
    );

    if (existingAllowance.gte(amount)) {
      return;
    }

    const tx = await Token.approve(
      this.collateralAsset.address,
      caller || this.signer,
      this.core.address,
      amount,
      overrides,
    );

    return tx.wait();
  }

  async approveSynthetic(
    amount: BigNumberish,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const token = IERC20Factory.connect(this.syntheticAsset.address, this.signer);

    const existingAllowance = await token.allowance(
      await this.signer.getAddress(),
      this.core.address,
    );

    if (existingAllowance.gte(amount)) {
      return;
    }

    const tx = await Token.approve(
      this.syntheticAsset.address,
      caller || this.signer,
      this.core.address,
      amount,
      overrides,
    );

    return tx.wait();
  }

  async openPosition(
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(caller);
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
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(caller);
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
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(caller);
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
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(
      Operation.Liquidate,
      {
        id: positionId,
        assetOne: '',
        amountOne: 0,
        assetTwo: '',
        amountTwo: 0,
      } as OperationParams,
      overrides,
    );

    return await this.parseActionTx(tx);
  }

  async setRiskParams(
    params: RiskParams,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getState(caller);
    return await contract.setRiskParams(params, overrides);
  }

  async setMarketParams(
    params: MarketParams,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getState(caller);
    return await contract.setMarketParams(params, overrides);
  }

  async parseActionTx(tx: any) {
    const receipt = await tx.wait();

    const decodedPosition = {} as ActionOperated;
    receipt.logs.forEach((log) => {
      try {
        const decoded = this.core.interface.decodeEventLog('ActionOperated', log.data, log.topics);
        Object.entries(decoded).forEach(([key, value]) => {
          decodedPosition[key] = value;
        });
      } catch {}
    });

    const position = {
      owner: decodedPosition.updatedPosition[0],
      collateralAsset: decodedPosition.updatedPosition[1],
      borrowedAsset: decodedPosition.updatedPosition[2],
      collateralAmount: {
        sign: decodedPosition.updatedPosition[3][0],
        value: decodedPosition.updatedPosition[3][1],
      },
      borrowedAmount: {
        sign: decodedPosition.updatedPosition[4][0],
        value: decodedPosition.updatedPosition[4][1],
      },
    } as Position;

    const result = {
      operation: decodedPosition.operation,
      params: {
        id: decodedPosition.params[0],
        assetOne: decodedPosition.params[1],
        amountOne: decodedPosition.params[2],
        assetTwo: decodedPosition.params[3],
        amountTwo: decodedPosition.params[4],
      },
      updatedPosition: position,
    } as ActionOperated;

    return result;
  }

  public async getCore(caller?: Signer) {
    return CoreV4Factory.connect(this.core.address, caller || this.signer);
  }

  public async getState(caller?: Signer) {
    return StateV1Factory.connect(this.state.address, caller || this.signer);
  }
}
