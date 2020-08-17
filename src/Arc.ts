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
} from './types';
import { CoreV1 } from './typings/CoreV1';
import { parseLogs } from './utils/parseLogs';
import { Proxy } from './typings/Proxy';
import { StateV1 } from './typings/StateV1';
import { AddressBook } from './addresses/AddressBook';
import { Config } from './addresses/Config';
import Token from '../src/utils/Token';
import { IERC20 } from './typings';
import { RiskParams, MarketParams } from './types';

export default class Arc {
  public wallet: Signer;

  public core: CoreV1;
  public state: StateV1;
  public syntheticAsset: IERC20;
  public collateralAsset: IERC20;
  public oracle: IOracle;

  static async init(wallet: Signer, addressBook?: AddressBook): Promise<Arc> {
    let arc = new Arc();
    arc.wallet = wallet;

    if (addressBook) {
      arc.core = await CoreV1.at(wallet, addressBook.proxy);
      arc.state = await StateV1.at(wallet, addressBook.stateV1);
      arc.syntheticAsset = await SyntheticToken.at(wallet, addressBook.syntheticToken);
      arc.collateralAsset = await IERC20.at(wallet, addressBook.collateralAsset);
      arc.oracle = await IOracle.at(wallet, addressBook.oracle);
    }

    return arc;
  }

  async deployArc(config: Config) {
    this.core = await CoreV1.deploy(this.wallet);

    const address = await this.wallet.getAddress();
    const proxy = await Proxy.deploy(this.wallet, this.core.address, address, []);

    this.core = await CoreV1.at(this.wallet, proxy.address);

    this.syntheticAsset = await SyntheticToken.deploy(
      this.wallet,
      proxy.address,
      config.name,
      config.symbol,
    );

    this.state = await StateV1.deploy(
      this.wallet,
      this.core.address,
      await this.wallet.getAddress(),
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
    caller: Signer = this.wallet,
    overrides: TransactionOverrides = {},
  ) {
    await Token.approve(
      this.collateralAsset.address,
      caller || this.wallet,
      this.core.address,
      amount,
      overrides,
    );
  }

  async approveSynthetic(
    amount: BigNumberish,
    caller: Signer = this.wallet,
    overrides: TransactionOverrides = {},
  ) {
    await Token.approve(
      this.syntheticAsset.address,
      caller || this.wallet,
      this.core.address,
      amount,
      overrides,
    );
  }

  async openPosition(
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller: Signer = this.wallet,
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
    caller: Signer = this.wallet,
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
    caller: Signer = this.wallet,
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
    caller: Signer = this.wallet,
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
    caller: Signer = this.wallet,
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getState(caller);
    return await contract.setRiskParams(params, overrides);
  }

  async setMarketParams(
    params: MarketParams,
    caller: Signer = this.wallet,
    overrides: TransactionOverrides = {},
  ) {
    const contract = await this.getState(caller);
    return await contract.setMarketParams(params, overrides);
  }

  async parseActionTx(tx: any) {
    const receipt = await tx.wait();
    const logs = parseLogs(receipt.logs, CoreV1.ABI);
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
    return await CoreV1.at(caller || this.wallet, this.core.address);
  }

  public async getState(caller?: Signer) {
    return await StateV1.at(caller || this.wallet, this.state.address);
  }
}
