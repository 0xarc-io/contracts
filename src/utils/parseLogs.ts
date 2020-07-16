import { ethers } from 'ethers';
import { LogDescription } from 'ethers/utils';

// suppress ABI warnings e.g. Multiple definitions for safeTransferFrom
ethers.errors.setLogLevel('error');

export function parseLogs(logs: ethers.providers.Log[], ...abis: string[]): any[] {
  let abi = '';
  if (abis.length > 1) {
    abis.forEach((a) => {
      // concatenate, removing the array brackets
      abi += a.slice(1, a.length - 1);
    });
    abi = `[${abi}]`;
  } else if (abis.length === 1) {
    abi = abis[0];
  }

  const iface = new ethers.utils.Interface(abi);

  return logs
    .map((log, index) => {
      return [iface.parseLog(log), index];
    })
    .filter((arr) => arr[0] != null)
    .map((arr) => {
      const item = arr[0] as LogDescription;
      const index = arr[1] as number;
      const result = {
        name: item.name,
        signature: item.signature,
        address: logs[index].address,
        values: {},
      };
      const keys = Object.keys(item.values);
      const values = Object.values(item.values);
      const start = item.values.length;

      for (let i = start; i <= start * 2 - 1; i++) {
        result.values[keys[i]] = values[i];
      }

      return result;
    });
}
