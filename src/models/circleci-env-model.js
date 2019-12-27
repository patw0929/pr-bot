class CircleCIEnvModel {
  get isCI() {
    return (process.env['CIRCLECI'] === 'true');
  }

  get isPullRequest() {
    return (!!process.env['CIRCLE_PULL_REQUEST'] && process.env['CIRCLE_PULL_REQUEST'] !== '');
  }

  get repoDetails() {
    if (!process.env['CIRCLE_PROJECT_REPONAME'] || !process.env['CIRCLE_PROJECT_USERNAME']) {
      return null;
    }

    return {
      owner: process.env['CIRCLE_PROJECT_USERNAME'],
      repo: process.env['CIRCLE_PROJECT_REPONAME'],
    }
  }

  // The target branch of the pull request OR the current
  // branch that is commited to.
  get gitBranch() {
    return process.env['CIRCLE_BRANCH'];
  }

  get pullRequestSha() {
    return process.env['CIRCLE_SHA1'];
  }

  get pullRequestNumber() {
    if (!process.env['CIRCLE_PULL_REQUEST']) {
      return undefined;
    }

    return process.env['CIRCLE_PULL_REQUEST'].split('/').pop();
  }
}

module.exports = CircleCIEnvModel;
