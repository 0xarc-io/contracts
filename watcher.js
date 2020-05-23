const chokidar = require('chokidar');
const jest = require("jest");
const system = require('system-commands');

// ============ Watchers ============ //

chokidar.watch('./contracts').on('change', async (event, path) => {
  system('yarn compile')
    .then((data) => {
      console.log(data);
      return system('yarn generate-typings');
    }).then((data) => {
      console.log(data);
      return jest.run();
    })
    .catch(console.error)
});

chokidar.watch('./test').on('change', async (event, path) => {
  jest.run();
});

chokidar.watch('./contracts').on('unlink', (event, path) => {
  system('echo Cleaning build...')
  exesystemcute('yarn clean');
  system('yarn build');
});