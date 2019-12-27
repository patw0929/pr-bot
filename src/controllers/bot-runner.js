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
const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const logHelper = require('../utils/log-helper');
const { CI_SERVICES_MAP } = require('../constants/ciServices');
const TravisEnvModel = require('../models/travis-env-model');
const CircleCIEnvModel = require('../models/circleci-env-model');
const GithubController = require('./github-controller');

const TMPDIR_PREFIX = `/tmp/pr-bot/`;

const CI_SERVICES_ENV_MODAL_MAP = {
  [CI_SERVICES_MAP.TRAVIS]: TravisEnvModel,
  [CI_SERVICES_MAP.CIRCLECI]: CircleCIEnvModel
}

class Bot {
  constructor({ configPath, ci } = {}) {
    logHelper.setPrimaryPrefix('PR-Bot 🤖');

    if (!configPath) {
      configPath = path.resolve('pr-bot.config.js')
    }
    this._configPath = configPath;
    this._ci = ci;
  }

  run() {
    const CIEnv = new CI_SERVICES_ENV_MODAL_MAP[this._ci]();

    return this._readConfig()
    .then((configuration) => {
      let repoDetails = CIEnv.repoDetails;
      if (!repoDetails) {
        repoDetails = configuration.repoDetails;
      }
      if (!repoDetails) {
        throw new Error(`Unable to get the Github 'repoDetails' from CI ` +
          `environment variable or the configuration file.`);
      }

      const githubController = new GithubController({
        owner: repoDetails.owner,
        repo: repoDetails.repo,
      });

      return this._buildBeforeAndAfter(configuration, CIEnv, githubController)
      .then(({beforePath, afterPath}) => {
        return this._runPlugins(configuration.plugins, {beforePath, afterPath});
      })
      .then((pluginResults) => {
        if (!CIEnv.isCI || !CIEnv.isPullRequest) {
          this._logDebugInfo(pluginResults);
          return Promise.resolve();
        }

        return this._logGithubState(configuration, CIEnv, githubController, pluginResults);
      });
    });
  }

  _readConfig() {
    return fs.access(this._configPath)
    .catch((err) => {
      throw new Error(`Unable to find the config file: '${this._configPath}'.`);
    })
    .then(() => {
      try {
        return require(this._configPath);
      } catch (err) {
        throw new Error(`A problem occurred running the config file.`);
      }
    })
  }

  _buildBeforeAndAfter(configuration, ciEnv, githubController) {
    fs.ensureDir(TMPDIR_PREFIX);

    return githubController.getRepoDetails()
    .then((repoDetails) => {
      const cloneUrl = repoDetails.data.clone_url;
      const beforePath = fs.mkdtempSync(TMPDIR_PREFIX);

      logHelper.log(`Cloning default branch into: '${beforePath}'.`);
      execSync(`git clone ${cloneUrl} ${beforePath}`);

      if (configuration.overrideBaseBranch) {
        execSync(`git checkout ${configuration.overrideBaseBranch}`, {
          cwd: beforePath
        });
      }

      if (!ciEnv.pullRequestSha) {
        logHelper.warn(`No SHA environment variable, ` +
          `so using the current directory for further testing.`);
        return {
          beforePath,
          afterPath: '.',
        };
      }

      const afterPath = fs.mkdtempSync(TMPDIR_PREFIX);

      logHelper.log(`Cloning default branch into: '${afterPath}'.`);
      execSync(`git clone ${cloneUrl} ${afterPath}`);
      execSync(`git checkout ${ciEnv.pullRequestSha}`, {
        cwd: afterPath,
      });

      return {
        beforePath,
        afterPath,
      };
    })
    .then(({beforePath, afterPath}) => {
      let buildCommand = `npm install && npm run build`;
      if (configuration.buildCommand) {
        buildCommand = configuration.buildCommand
      }

      logHelper.log(`Building before and after versions with: '${buildCommand}'.`);

      try {
        execSync(buildCommand, {
          cwd: beforePath,
        });
      } catch (err) {
        logHelper.error(`Unable to run '${buildCommand}' in the "before" version.`);
      }

      try {
        execSync(buildCommand, {
          cwd: afterPath,
        });
      } catch (err) {
        logHelper.error(`Unable to run '${buildCommand}' in the "after" version.`);
        throw err;
      }

      return {beforePath, afterPath};
    });
  }

  _runPlugins(plugins, details) {
    const pluginResults = {};
    return plugins.reduce((promiseChain, plugin) => {
      logHelper.log(`Running Plugins....`);
      return promiseChain.then(() => {
        if (!plugin.name) {
          throw new Error(`One of the plugins has failed to define a name ` +
            `property. This is required for reporting.`);
        }

        logHelper.log(`  ${plugin.name}`);

        return plugin.run(details)
        .catch((err) => {
          throw new Error(`The '${plugin.name}' threw an error while ` +
            `running: '${err.message}'`);
        })
        .then((result) => {
          pluginResults[plugin.name] = result;
        });
      });
    }, Promise.resolve())
    .then(() => {
      logHelper.log(``);
      return pluginResults;
    });
  }

  _logDebugInfo(pluginResults) {
    logHelper.log(`Results from plugins`);

    const pluginNames = Object.keys(pluginResults);
    pluginNames.forEach((pluginName) => {
      const result = pluginResults[pluginName];
      logHelper.log(`  ${pluginName}`);
      if (result.prettyLog) {
        console.log('');
        console.log(result.prettyLog);
        console.log('');
      } else {
        logHelper.log('    This plugin provided no log output.');
      }
    });
  }

  _logGithubState(configuration, ciEnv, githubController, pluginResults) {
    let githubComment = ``;
    let failPR = false;
    const pluginNames = Object.keys(pluginResults);
    pluginNames.forEach((pluginName) => {
      const result = pluginResults[pluginName];
      githubComment += `### ${pluginName}\n\n`;
      if (result.markdownLog) {
        githubComment += result.markdownLog;
      } else {
        githubComment += `This plugin provided no markdown output.`;
      }
      githubComment += `\n\n`;

      if (result.failPR) {
        failPR = true;
      }
    });

    let deletePromise = Promise.resolve();
    if (configuration.botUsername) {
      deletePromise = githubController.deletePreviousIssueComments({
        number: ciEnv.pullRequestNumber,
        botName: configuration.botUsername
      });
    }

    return deletePromise
    .then(() => {
      return githubController.postIssueComment({
        number: ciEnv.pullRequestNumber,
        comment: githubComment,
      });
    })
    .then(() => {
      return githubController.postState({
        sha: ciEnv.pullRequestSha,
        state: failPR ? 'failure' : 'success'
      })
    });
  }
}

module.exports = Bot;
