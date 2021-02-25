import fs from 'fs';

export function readCsv(filePath, lineSeparator = '\n', valueSeparator = ',') {
  const data = fs.readFileSync(filePath, {
    encoding: 'utf8',
    flag: 'r',
  });
  return data.split(lineSeparator).map((row) => row.split(valueSeparator));
}
