'use strict';

import program from 'commander';

require('pretty-error').start();
require('dotenv').config();

require('./src/commands/build').cmd(program);
require('./src/commands/deploy').cmd(program);
require('./src/commands/deploy-staking').cmd(program);
require('./src/commands/verify').cmd(program);
require('./src/commands/release').cmd(program);
require('./src/commands/versions-update').cmd(program);

program.parse(process.argv);
