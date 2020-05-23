import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { Artifact } from './types';

export interface ArtifactCache {
  hasChanged(artifact: Artifact): boolean;
  update(artifact: Artifact): void;
}

export class JSONCache implements ArtifactCache {
  out: string;
  model: any;

  constructor(out: string) {
    this.out = out;
    try {
      this.model = JSON.parse(readFileSync(this.cacheFilePath()).toString());
    } catch (e) {
      this.model = {};
    }
  }

  public hasChanged(artifact: Artifact): boolean {
    if (!this.model.contracts || !this.model.contracts[artifact.name]) {
      return true;
    }
    const cached = this.model.contracts[artifact.name].hash;
    const newHash = this.artifactHash(artifact);
    return cached != newHash;
  }

  public update(artifact: Artifact): void {
    if (!this.model.contracts) {
      this.model.contracts = {};
    }
    if (!this.model.contracts[artifact.name]) {
      this.model.contracts[artifact.name] = {};
    }
    this.model.contracts[artifact.name].hash = this.artifactHash(artifact);
    const data = JSON.stringify(this.model, null, 2);
    writeFileSync(this.cacheFilePath(), data);
  }

  private cacheFilePath(): string {
    return path.join(this.out, 'bindings-generator.json');
  }

  private artifactHash(artifact: Artifact): string {
    return crypto
      .createHash('md5')
      .update(artifact.abi.toString() + artifact.bytecode)
      .digest('hex');
  }
}
