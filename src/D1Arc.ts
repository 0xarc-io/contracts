import { Wallet, Signer } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { IOracle } from './typings/IOracle';
import { SyntheticToken } from './typings/SyntheticToken';

import {
  AssetType,
  Operation,
  OperationParams,
  ActionOperated,
  Position,
  TransactionOverrides,
  SynthAddressBook,
} from './types';
import { CoreV4 } from './typings/CoreV4';
import { parseLogs } from './utils/parseLogs';
import { StateV1 } from './typings/StateV1';
import Token from './utils/Token';
import { IERC20 } from './typings/IERC20';
import { RiskParams, MarketParams, DeploymentConfig } from './types';
import { ArcProxy } from './typings/ArcProxy';

export default class D1Arc {
  public signer: Signer;

  public core: CoreV4;
  public state: StateV1;
  public syntheticAsset: IERC20;
  public collateralAsset: IERC20;
  public oracle: IOracle;

  static async init(signer: Signer, addressBook?: SynthAddressBook): Promise<D1Arc> {
    let arc = new D1Arc();
    arc.signer = signer;

    if (addressBook) {
      arc.core = await CoreV4.at(signer, addressBook.proxy);
      arc.state = await StateV1.at(signer, addressBook.state);
      arc.syntheticAsset = await SyntheticToken.at(signer, addressBook.syntheticToken);
      arc.collateralAsset = await IERC20.at(signer, addressBook.collateralAsset);
      arc.oracle = await IOracle.at(signer, addressBook.oracle);
    }

    return arc;
  }

  async deployArc(config: DeploymentConfig) {
    this.core = await CoreV4.deploy(this.signer);

    const address = await this.signer.getAddress();
    const proxy = await ArcProxy.deploy(this.signer, this.core.address, address, []);

    this.core = await CoreV4.at(this.signer, proxy.address);

    this.syntheticAsset = await SyntheticToken.deploy(this.signer, config.name, config.symbol);

    await SyntheticToken.at(this.signer, this.syntheticAsset.address).addMinter(this.core.address);

    this.state = await StateV1.deploy(
      this.signer,
      this.core.address,
      config.collateralAsset,
      this.syntheticAsset.address,
      config.oracle,
      {
        collateralRatio: { value: config.collateralRatio },
        liquidationArcFee: { value: config.liquidationArcFee },
        liquidationUserFee: { value: config.liquidationUserFee },
      },
      {
        collateralLimit: '',
        syntheticLimit: '',
        positionCollateralMinimum: '',
      },
    );

    await this.core.init(this.state.address);
  }

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
    collateralAsset: AssetType,
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
    const logs = parseLogs(receipt.logs, CoreV4.ABI);
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
    return await CoreV4.at(caller || this.signer, this.core.address);
  }

  public async getState(caller?: Signer) {
    return await StateV1.at(caller || this.signer, this.state.address);
  }
}
