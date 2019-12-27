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
const sinon = require('sinon');
const path = require('path');
const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const { CI_SERVICES_MAP } = require('../../src/constants/ciServices');

class FakeGithubController {
  getRepoDetails() {
    return Promise.resolve({
      data: {
        clone_url: 'http://fake-url.from/fake-github-controller'
      }
    });
  }
  postIssueComment(options) {
    console.log(options);
  }
}

const BotRunner = proxyquire('../../src/controllers/bot-runner.js', {
  './github-controller': FakeGithubController,
  'child_process': {
    execSync: (command) => {
      console.log(`Running fake execSync command: '${command}'`);
    }
  }
});

describe('bot-runner', function() {
  let stubs = [];

  afterEach(function() {
    stubs.forEach((stub) => {
      stub.restore();
    });
    stubs = [];

    delete process.env['TRAVIS'];
    delete process.env['TRAVIS_EVENT_TYPE'];
    delete process.env['TRAVIS_PULL_REQUEST'];
    delete process.env['TRAVIS_REPO_SLUG'];
  });

  it('should instantiate Travis Bot', function() {
    new BotRunner();
  });

  it('should error when no repo-details in config or travis', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/no-repo-details.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expected error to be thrown due to no repo details');
    }, (err) => {
      expect(err.message.indexOf(`Unable to get the Github 'repoDetails'`))
        .to.not.equal(-1);
    });
  });

  it ('should get repo details from travis', function() {
    process.env['TRAVIS_REPO_SLUG'] = 'gauntface/example-repo';

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/no-repo-details.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  })

  it('should instantiate Travis Bot and print to log', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    const logSpy = sinon.spy(bot, '_logDebugInfo');

    return bot.run()
    .then(() => {
      expect(logSpy.calledOnce).to.equal(true);
    });
  });

  it('should handle no name plugins', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/no-plugin-name.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expect bad plugin to throw error.');
    }, (err) => {
      expect(err.message).to.equal('One of the plugins has failed to define a name property. This is required for reporting.');
    });
  });

  it('should handle bad plugins', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/bad-plugin.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expect bad plugin to throw error.');
    }, (err) => {
      expect(err.message).to.equal(`The 'Bad Plugin will Error.' threw an error while running: 'Inject Error'`);
    });
  });

  it('should handle good custom plugin', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should try to print to Github', function() {
    process.env['TRAVIS'] = 'true';
    process.env['TRAVIS_EVENT_TYPE'] = 'pull_request';
    process.env['TRAVIS_PULL_REQUEST'] = '123';
    process.env['TRAVIS_PULL_REQUEST_SHA'] = 'ABCSHA';

    const deleteStub = sinon.stub(FakeGithubController.prototype, 'deletePreviousIssueComments').callsFake((input) => {
      expect(input).to.deep.equal({
        number: '123',
        botName: 'test-bot'
      });
      return Promise.resolve();
    });
    stubs.push(deleteStub);

    const stateStub = sinon.stub(FakeGithubController.prototype, 'postState').callsFake((input) => {
      expect(input).to.deep.equal({
        sha: 'ABCSHA',
        state: 'success'
      });
      return Promise.resolve();
    });
    stubs.push(stateStub);

    const issueStub = sinon.stub(FakeGithubController.prototype, 'postIssueComment').callsFake((input) => {
      expect(input).to.deep.equal({
        number: '123',
        comment: '### Good Plugin.\n\nThis plugin provided no markdown output.\n\n### Good Plugin 2.\n\n`Hello  from good plugin.`\n\n',
      });
      return Promise.resolve();
    });
    stubs.push(issueStub);

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should try to print to Github without deleting previous comments', function() {
    process.env['TRAVIS'] = 'true';
    process.env['TRAVIS_EVENT_TYPE'] = 'pull_request';
    process.env['TRAVIS_PULL_REQUEST'] = '123';
    process.env['TRAVIS_PULL_REQUEST_SHA'] = 'ABCSHA';

    const stateStub = sinon.stub(FakeGithubController.prototype, 'postState').callsFake((input) => {
      expect(input).to.deep.equal({
        sha: 'ABCSHA',
        state: 'success'
      });
      return Promise.resolve();
    });
    stubs.push(stateStub);

    const issueStub = sinon.stub(FakeGithubController.prototype, 'postIssueComment').callsFake((input) => {
      expect(input).to.deep.equal({
        number: '123',
        comment: '### Good Plugin.\n\nThis plugin provided no markdown output.\n\n### Good Plugin 2.\n\n`Hello  from good plugin.`\n\n'
      });
      return Promise.resolve();
    });
    stubs.push(issueStub);

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin-no-bot-name.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should fail the PR', function() {
    process.env['TRAVIS'] = 'true';
    process.env['TRAVIS_EVENT_TYPE'] = 'pull_request';
    process.env['TRAVIS_PULL_REQUEST'] = '123';
    process.env['TRAVIS_PULL_REQUEST_SHA'] = 'ABCSHA';

    const deleteStub = sinon.stub(FakeGithubController.prototype, 'deletePreviousIssueComments').callsFake((input) => {
      expect(input).to.deep.equal({
        number: '123',
        botName: 'test-bot'
      });
      return Promise.resolve();
    });
    stubs.push(deleteStub);

    const stateStub = sinon.stub(FakeGithubController.prototype, 'postState').callsFake((input) => {
      expect(input).to.deep.equal({
        sha: 'ABCSHA',
        state: 'failure'
      });
      return Promise.resolve();
    });
    stubs.push(stateStub);

    const issueStub = sinon.stub(FakeGithubController.prototype, 'postIssueComment').callsFake((input) => {
      expect(input).to.deep.equal({
        number: '123',
        comment: '### Good Plugin that will fail build.\n\n`Hello  from failing build plugin.`\n\n',
      });
      return Promise.resolve();
    });
    stubs.push(issueStub);

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin-that-fails-build.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should pull from repo when its a Travis PR', function() {
    process.env['TRAVIS_PULL_REQUEST_SHA'] = '123';

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should handle non-existant config file', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/doesnt-exist.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expected error to be thrown.');
    }, (err) => {
      expect(err.message.indexOf('Unable to find the config file')).to.equal(0);
    });
  });

  it('should handle throwing config file', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/throwing.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expected error to be thrown.');
    }, (err) => {
      expect(err.message.indexOf('A problem occurred running the config file.')).to.equal(0);
    });
  });

  it('should handle non-returning config file', function() {
    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/non-returning.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run()
    .then(() => {
      throw new Error('Expected error to be thrown.');
    }, (err) => {
      expect(err.message).to.equal(`Unable to get the Github 'repoDetails' from CI environment variable or the configuration file.`);
    });
  });

  it('should be ok building for local folder and tmp master checkout when run locally', function() {
    delete process.env['TRAVIS_PULL_REQUEST_SHA'];

    const bot = new BotRunner({
      configPath: path.join(__dirname, '../static/example-with-plugin.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });

    return bot.run();
  });

  it('should checkout the base branch override', function() {
    let currentCallNumber = 0;
    const CustomBotRunner = proxyquire('../../src/controllers/bot-runner.js', {
      './github-controller': FakeGithubController,
      'child_process': {
        execSync: (command, options) => {
          switch(currentCallNumber) {
            case 0:
              expect(command.indexOf('git clone http://fake-url.from/fake-github-controller /tmp/pr-bot/')).to.equal(0);
              break;
            case 1:
              expect(command).to.equal('git checkout example-base-branch-override');
              expect(options.cwd.indexOf('/tmp/pr-bot/')).to.equal(0);
              break;
            case 2:
            case 3:
              expect(command).to.equal('gulp example-build-rule');
              break;
            default:
              throw new Error('Unexpected number of execSync calls');
          }
          currentCallNumber++;
        }
      }
    });

    const bot = new CustomBotRunner({
      configPath: path.join(__dirname, '../static/base-branch-override.config.js'),
      ci: CI_SERVICES_MAP.TRAVIS
    });
    return bot.run()
    .then(() => {
      if (currentCallNumber !== 4) {
        throw new Error('Expected execSync to be called 4 times.');
      }
    });
  });
});
