import { readCsv } from '@src/utils/readCsv';
import { expect } from 'chai';

describe('readCsv', () => {
  it('correctly parse first line', () => {
    const csvArray = readCsv(`${__dirname}/test.csv`);
    expect(csvArray).length(4)
    expect(csvArray[0]).to.deep.eq(['0x77da151402d33cbf3e0123b123d7b57c28d95cfd', '76051390970352']);
  });
});
