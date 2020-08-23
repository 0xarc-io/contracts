'use strict';

import program from 'commander';

require('pretty-error').start();
require('dotenv').config();

require('./src/commands/build').cmd(program);
require('./src/commands/deploy').cmd(program);
require('./src/commands/verify').cmd(program);

program.parse(process.argv);
