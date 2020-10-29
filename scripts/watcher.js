const chokidar = require('chokidar');
const _ = require('lodash');
const system = require('system-commands');
const shell = require('shelljs'); // This module is already a solidity-coverage dep

const { gray, green, yellow, redBright, red } = require('chalk');

let lastRunPath = process.argv[process.argv.length - 1];
runTest(lastRunPath);

// ============ Watchers ============ //

chokidar.watch('./contracts').on(
	'change',
	_.debounce(async (path, event) => {
		console.log(yellow(`Contracts changed: ${path}`));
		system('yarn compile')
			.then((data) => {
				return system('yarn generate-typings');
			})
			.then((data) => {
				return runTest(lastRunPath);
			})
			.catch(console.error);
	}),
	500
);

chokidar.watch('./test').on(
	'change',
	_.debounce(async (path, event) => {
		console.log(yellow(`Tests changed: ${path}`));
		await runTest(path);
	}),
	500
);

async function runTest(path) {
	if (!path) {
		return;
	}

	lastRunPath = path;
	shell.exec(`yarn buidler test ${path}`);
	let splitPath = lastRunPath.split('/');
	console.log(green(`Finished running: ${splitPath[splitPath.length - 1]}`));
}
