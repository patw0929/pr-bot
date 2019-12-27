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
const expect = require('chai').expect;
const CircleCIEnvModel = require('../../src/models/circleci-env-model');

describe('circleci-env-model', function() {
  it('is not travis', function() {
    delete process.env['CIRCLECI'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.isCI).to.equal(false);
  });

  it('is CircleCI', function() {
    process.env['CIRCLECI'] = 'true';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.isCI).to.equal(true);
  });

  it('is not pull request', function() {
    delete process.env['CIRCLE_PULL_REQUEST'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.isPullRequest).to.equal(false);
  });

  it('is not pull request either', function() {
    process.env['CIRCLE_PULL_REQUEST'] = '';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.isPullRequest).to.equal(false);
  });

  it('is pull request', function() {
    process.env['CIRCLE_PULL_REQUEST'] = 'https://github.com/owner/repo/pull/249';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.isPullRequest).to.equal(true);
  });

  it('no repo details', function() {
    delete process.env['CIRCLE_PROJECT_REPONAME'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.repoDetails).to.equal(null);
  });

  it('no repo details either', function() {
    process.env['CIRCLE_PROJECT_REPONAME'] = 'example';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.repoDetails).to.equal(null);
  });

  it('no repo details as well', function() {
    process.env['CIRCLE_PROJECT_REPONAME'] = 'example/example-two/nope';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.repoDetails).to.equal(null);
  });

  it('get repo details', function() {
    process.env['CIRCLE_PROJECT_USERNAME'] = 'example-owner';
    process.env['CIRCLE_PROJECT_REPONAME'] = 'example-repo';

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.repoDetails).to.deep.equal({
      owner: 'example-owner',
      repo: 'example-repo',
    });
  });

  it('no PR sha', function() {
    delete process.env['CIRCLE_PULL_REQUEST_SHA'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestSha).to.equal(undefined);
  });

  it('get PR sha', function() {
    const injectedSha = '123456789abcde';
    process.env['CIRCLE_SHA1'] = injectedSha;

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestSha).to.equal(injectedSha);
  });

  it('no PR number', function() {
    delete process.env['CIRCLE_PULL_REQUEST'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestNumber).to.equal(undefined);
  });

  it('get PR number', function() {
    const injectedPR = '123456';
    process.env['CIRCLE_PULL_REQUEST'] = `https://github.com/owner/repo/pull/${injectedPR}`;

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestNumber).to.equal(injectedPR);
  });

  it('should return undefined for no git branch', function() {
    delete process.env['CIRCLE_BRANCH'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.gitBranch).to.equal(undefined);
  });

  it('should return git branch', function() {
    const branch = 'my-random-branch';
    process.env['CIRCLE_BRANCH'] = branch;

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.gitBranch).to.equal(branch);
  });

  it('should return undefined for PR num', function() {
    delete process.env['CIRCLE_PULL_REQUEST'];

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestNumber).to.equal(undefined);
  });

  it('should return the PR num', function() {
    const prNum = '123';
    process.env['CIRCLE_PULL_REQUEST'] = `https://github.com/owner/repo/${prNum}`;

    const circleCIEnv = new CircleCIEnvModel();
    expect(circleCIEnv.pullRequestNumber).to.equal(prNum);
  });
});
