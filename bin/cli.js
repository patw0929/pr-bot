#! /usr/bin/env node

/**
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const meow = require('meow');
const path = require('path');
const logHelper = require('../src/utils/log-helper');
const BotRunner = require('../src/controllers/bot-runner');
const { CI_SERVICES_MAP } = require('../src/constants/ciServices');

const cli = meow(`
    Usage
      $ pr-bot

    Options
      -c, --config  Optional path to config file [Defaults to pr-bot.config.js]
      --ci Use Travis (`travis`) or CircleCI (`circleci`) as CI service. [Defaults to circleci]

    Examples
      $ pr-bot
      $ pr-bot --config ./config/my-pr-bot-config.js
      $ pr-bot --ci travis
`, {
    alias: {
        c: 'config'
    }
});

const options = {};
if (cli.flags.config) {
  options.configPath = path.resolve(cli.flags.config);
}
if (cli.flags.ci) {
  options.ci = cli.flags.ci
} else {
  options.ci = CI_SERVICES_MAP.CIRCLECI
}

const botRunner = new BotRunner[options.ci](options);
botRunner.run()
  .catch((err) => {
    logHelper.error(err);
    process.exit(1);
  });
