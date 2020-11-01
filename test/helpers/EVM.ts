import { JsonRpcProvider } from 'ethers/providers';

export class EVM {
  private provider: JsonRpcProvider;
  private _snapshotId: string;

  constructor(provider: JsonRpcProvider) {
    this.provider = provider;
  }

  public setProvider(provider: JsonRpcProvider): void {
    this.provider = provider;
  }

  /**
   * Attempts to reset the EVM to its initial state. Useful for testing suites
   */
  public async resetEVM(resetSnapshotId: string = '0x1'): Promise<void> {
    const id = await this.snapshot();

    if (id !== resetSnapshotId) {
      await this.reset(resetSnapshotId);
    }
  }

  public async reset(id: string): Promise<string> {
    if (!id) {
      throw new Error('id must be set');
    }

    await this.callJsonrpcMethod('evm_revert', [id]);

    return this.snapshot();
  }

  public async snapshot(): Promise<string> {
    this._snapshotId = await this.callJsonrpcMethod('evm_snapshot');
    return this._snapshotId;
  }

  public async evmRevert(id: string = this._snapshotId): Promise<string> {
    return this.callJsonrpcMethod('evm_revert', [id]);
  }

  public async stopMining(): Promise<string> {
    return this.callJsonrpcMethod('miner_stop');
  }

  public async startMining(): Promise<string> {
    return this.callJsonrpcMethod('miner_start');
  }

  public async mineBlock(): Promise<string> {
    return this.callJsonrpcMethod('evm_mine');
  }

  public async increaseTime(duration: number): Promise<string> {
    return this.callJsonrpcMethod('evm_increaseTime', [duration]);
  }

  public async callJsonrpcMethod(method: string, params: any[] = []): Promise<string> {
    const response = await this.provider.send(method, params);
    return response;
  }

  async mineAvgBlock() {
    await this.increaseTime(15);
    await this.mineBlock();
  }

  async fastForward(seconds: number) {
    await this.increaseTime(seconds);
    await this.mineBlock();
  }
}
