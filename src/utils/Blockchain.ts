import { JsonRpcProvider, Web3Provider } from 'ethers/providers';
import { ethers } from 'ethers';

export class Blockchain {

  private _provider: Web3Provider | JsonRpcProvider;
  private _snapshotId: number;

  constructor(_provider?: Web3Provider | JsonRpcProvider) {
    if (!_provider) {
      _provider = new ethers.providers.JsonRpcProvider();
    }
    this._provider = _provider;

    this._snapshotId = 0;
  }

  public async saveSnapshotAsync(): Promise<void> {
    const response = await this.sendJSONRpcRequestAsync('evm_snapshot', []);
    this._snapshotId = Number(response);
  }

  public async revertAsync(): Promise<void> {
    await this.sendJSONRpcRequestAsync('evm_revert', [this._snapshotId]);
  }

  public async resetAsync(): Promise<void> {
    await this.sendJSONRpcRequestAsync('evm_revert', ['0x1']);
  }

  public async increaseTimeAsync(duration: number): Promise<any> {
    await this.sendJSONRpcRequestAsync('evm_increaseTime', [duration]);
  }

  public async waitBlocksAsync(count: number) {
    for (let i = 0; i < count; i++) {
      await this.sendJSONRpcRequestAsync('evm_mine', []);
    }
  }

  private async sendJSONRpcRequestAsync(method: string, params: any[]): Promise<any> {
    return this._provider.send(method, params);
  }
}
