import { Wallet, ethers, ContractTransaction } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { StableShare } from '../typechain/StableShare';
import { AddressZero } from 'ethers/constants';
import { MockOracle } from '../typechain/MockOracle';
import ArcDecimal from './utils/ArcDecimal';
import { SyntheticToken } from '../typechain/SyntheticToken';
import { PolynomialInterestSetter } from '../typechain/PolynomialInterestSetter';
import { AssetType, Operation, OperationParams, ActionOperated } from './types';
import { Storage } from '../typechain/Storage';
import { State } from '../typechain/State';
import { CoreV1 } from '../typechain/CoreV1';
import { parseLogs } from './utils/parseLogs';

const ZERO = new BigNumber(0);
const BASE = new BigNumber(10).pow(18);

export default class Arc {
  public wallet: Wallet;

  public core: CoreV1;
  public state: State;
  public synthetic: SyntheticToken;
  public stableShare: StableShare;
  public oracle: MockOracle;
  public interestModel: PolynomialInterestSetter;

  static async init(wallet: Wallet): Promise<Arc> {
    let arc = new Arc();
    arc.wallet = wallet;
    return arc;
  }

  async deployArc(interestSetter: string, stableShare: string, oracle: string) {
    this.core = await CoreV1.deploy(this.wallet);

    this.synthetic = await SyntheticToken.deploy(
      this.wallet,
      this.core.address,
      'ARCxBTC',
      'ARCBTC',
    );

    this.state = await State.deploy(this.wallet, this.core.address, {
      syntheticAsset: this.synthetic.address,
      stableAsset: stableShare,
      interestSetter: interestSetter,
      collateralRatio: ArcDecimal.new(2),
      syntheticRatio: ArcDecimal.new(2),
      liquidationSpread: ArcDecimal.new(0.1),
      originationFee: ArcDecimal.new(0.01),
      earningsRate: ArcDecimal.new(0.1),
      oracle: oracle,
    });

    await this.core.initializeV1(this.state.address);
  }

  async supply(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(Operation.Supply, {
      id: 0,
      assetOne: AssetType.Stable,
      amountOne: amount,
      assetTwo: '',
      amountTwo: 0,
    });
    return await this.parseActionTx(tx);
  }

  async withdraw(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(Operation.Withdraw, {
      id: 0,
      assetOne: AssetType.Stable,
      amountOne: amount,
      assetTwo: '',
      amountTwo: 0,
    });
    return await this.parseActionTx(tx);
  }

  async openPosition(
    collateralAsset: AssetType,
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller?: Wallet,
  ) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(Operation.Open, {
      id: 0,
      assetOne: collateralAsset,
      amountOne: collateralAmount,
      assetTwo: '',
      amountTwo: borrowAmount,
    });
    return await this.parseActionTx(tx);
  }

  async borrow(
    positionId: BigNumberish,
    collateralAsset: AssetType,
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller?: Wallet,
  ) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(Operation.Borrow, {
      id: positionId,
      assetOne: collateralAsset,
      amountOne: collateralAmount,
      assetTwo: '',
      amountTwo: borrowAmount,
    });

    return await this.parseActionTx(tx);
  }

  async liquidatePosition(positionId: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    const tx = await contract.operateAction(Operation.Liquidate, {
      id: positionId,
      assetOne: '',
      amountOne: 0,
      assetTwo: '',
      amountTwo: 0,
    } as OperationParams);

    return await this.parseActionTx(tx);
  }

  async parseActionTx(tx: ContractTransaction) {
    const receipt = await tx.wait();
    const logs = parseLogs(receipt.logs, CoreV1.ABI);
    const log = logs[0];

    const result = {
      operation: log.values.operation,
      params: {
        id: log.values.params[0],
        assetOne: log.values.params[1],
        amountOne: log.values.params[2],
        assetTwo: log.values.params[3],
        amountTwo: log.values.params[4],
      },
      updatedPosition: log.values.updatedPosition,
    } as ActionOperated;

    return result;
  }

  async getCore(caller?: Wallet) {
    return await CoreV1.at(caller || this.wallet, this.core.address);
  }
}
