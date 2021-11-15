import { utils } from 'ethers';

export default class MerkleTree {
  private readonly bufferElementPositionIndex: { [hexElement: string]: number };
  private readonly layers: string[][];

  constructor(elements: string[]) {
    console.log(`2a. Creating Merkle Tree!\n`);
    const start = new Date().getTime();
    let now = start
    console.log(`2b. Saving elements took ${(new Date().getTime() - now)/1000} secs !\n`);
    now = new Date().getTime()
    elements.sort();
    console.log(`2b. Sorting tree took ${(new Date().getTime() - now)/1000} secs !\n`);
    now = new Date().getTime()
    elements = MerkleTree.deduplicateSortedElements(elements);
    console.log(`2c. Deduplicating tree took ${(new Date().getTime() - now)/1000} secs !\n`);
    now = new Date().getTime()
    this.bufferElementPositionIndex = elements.reduce<{ [hexElement: string]: number }>(
      (memo, el, index) => {
        memo[el] = index;
        return memo;
      },
      {},
    );
    console.log(`2d. Creating buffer took ${(new Date().getTime() - now)/1000} secs !\n`);
    now = new Date().getTime()
    this.layers = this.getLayers(elements);
    console.log(`2e. Creating layers took ${(new Date().getTime() - now)/1000} secs !\n`);
  }

  getLayers(elements: string[]): string[][] {
    if (elements.length === 0) {
      throw new Error('empty tree');
    }

    const layers = [];
    layers.push(elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  getNextLayer(elements: string[]): string[] {
    return elements.reduce<string[]>((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(MerkleTree.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, []);
  }

  static combinedHash(first: string, second: string): string {
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }
    return utils.keccak256(MerkleTree.sortAndConcat(first, second));
  }

  getRoot(): string {
    return this.layers[this.layers.length - 1][0];
  }

  getHexRoot(): string {
    return this.getRoot();
  }

  getProof(el: string) {
    let idx = this.bufferElementPositionIndex[el];

    if (typeof idx !== 'number') {
      throw new Error('Element does not exist in Merkle tree');
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = MerkleTree.getPairElement(idx, layer);

      if (pairElement) {
        proof.push(pairElement);
      }

      idx = Math.floor(idx / 2);

      return proof;
    }, []);
  }

  private static getPairElement(idx: number, layer: string[]): string | null {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (pairIdx < layer.length) {
      return layer[pairIdx];
    } else {
      return null;
    }
  }

  private static deduplicateSortedElements(elements: string[]): string[] {
    return elements.filter((el, idx) => {
      return idx === 0 || !(elements[idx - 1] === el);
    });
  }

  private static sortAndConcat(...args: string[]): string {
    const sortedArgs = [...args].map((value) => value.substr(2)).sort();
    return '0x'.concat(...sortedArgs);
  }
}
