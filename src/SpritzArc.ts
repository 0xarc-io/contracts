import { Signer } from 'ethers';
import { BigNumberish } from 'ethers';
import { IOracle } from './typings/IOracle';

import {
  Operation,
  OperationParams,
  ActionOperated,
  Position,
  SynthAddressBook,
} from '../@types/core';

import { parseLogs } from './utils/parseLogs';
import Token from './utils/Token';

import { CoreV4Factory, StateV1Factory, StaticSyntheticTokenFactory } from './typings';
import { Ierc20Factory } from './typings/Ierc20Factory';
import { IOracleFactory } from './typings/IOracleFactory';
import { StateV1 } from './typings/StateV1';
import { CoreV4 } from './typings/CoreV4';
import { Ierc20 } from './typings/Ierc20';

import { RiskParams, MarketParams, DeploymentConfig } from '../@types/core';
import { TransactionOverrides } from '../@types/ethereum';

export class SpritzArc {
  public signer: Signer;

  public core: CoreV4;
  public state: StateV1;
  public syntheticAsset: Ierc20;
  public collateralAsset: Ierc20;
  public oracle: IOracle;

  static async init(signer: Signer, addressBook?: SynthAddressBook): Promise<SpritzArc> {
    let arc = new SpritzArc();
    arc.signer = signer;

    if (addressBook) {
      arc.core = await new CoreV4Factory(signer).attach(addressBook.proxy);
      arc.state = await new StateV1Factory(signer).attach(addressBook.state);
      arc.syntheticAsset = await new StaticSyntheticTokenFactory(signer).attach(
        addressBook.syntheticToken,
      );
      arc.collateralAsset = await Ierc20Factory.connect(addressBook.collateralAsset, signer);
      arc.oracle = await IOracleFactory.connect(addressBook.oracle, signer);
    }

    return arc;
  }

  // async deployArc(config: DeploymentConfig) {
  //   this.core = await CoreV4.deploy(this.signer);

  //   const address = await this.signer.getAddress();
  //   const proxy = await ArcProxy.deploy(this.signer, this.core.address, address, []);

  //   this.core = await CoreV4.at(this.signer, proxy.address);

  //   this.syntheticAsset = await StaticSyntheticToken.deploy(
  //     this.signer,
  //     config.name,
  //     config.symbol,
  //   );

  //   await StaticSyntheticToken.at(this.signer, this.syntheticAsset.address).addMinter(
  //     this.core.address,
  //   );

  //   this.state = await StateV1.deploy(
  //     this.signer,
  //     this.core.address,
  //     config.collateralAsset,
  //     this.syntheticAsset.address,
  //     config.oracle,
  //     {
  //       collateralRatio: { value: config.collateralRatio },
  //       liquidationArcFee: { value: config.liquidationArcFee },
  //       liquidationUserFee: { value: config.liquidationUserFee },
  //     },
  //     {
  //       collateralLimit: '',
  //       syntheticLimit: '',
  //       positionCollateralMinimum: '',
  //     },
  //   );

  //   await this.core.init(this.state.address);
  // }

  async approveStableShare(
    amount: BigNumberish,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    await Token.approve(
      this.collateralAsset.address,
      caller || this.signer,
      this.core.address,
      amount,
      overrides,
    );
  }

  async approveSynthetic(
    amount: BigNumberish,
    caller: Signer = this.signer,
    overrides: TransactionOverrides = {},
  ) {
    await Token.approve(
      this.syntheticAsset.address,
      caller || this.signer,
      this.core.address,
      amount,
      overrides,
    );
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
    // TODO: Fix this
    const logs = parseLogs(receipt.logs, '');
    const log = logs[0];

    const position = {
      owner: log.values.updatedPosition[0],
      collateralAsset: log.values.updatedPosition[1],
      borrowedAsset: log.values.updatedPosition[2],
      collateralAmount: {
        sign: log.values.updatedPosition[3][0],
        value: log.values.updatedPosition[3][1],
      },
      borrowedAmount: {
        sign: log.values.updatedPosition[4][0],
        value: log.values.updatedPosition[4][1],
      },
    } as Position;

    const result = {
      operation: log.values.operation,
      params: {
        id: log.values.params[0],
        assetOne: log.values.params[1],
        amountOne: log.values.params[2],
        assetTwo: log.values.params[3],
        amountTwo: log.values.params[4],
      },
      updatedPosition: position,
    } as ActionOperated;

    return result;
  }

  public async getCore(caller?: Signer) {
    return await new CoreV4Factory(caller || this.signer).attach(this.core.address);
  }

  public async getState(caller?: Signer) {
    return await new StateV1Factory(caller || this.signer).attach(this.state.address);
  }
}
