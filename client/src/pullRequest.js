// Same pull request rule as the server's validateSubmissionUrl (server/src/validate.js).
// Accepts what people copy from a PR page: .../pull/12, .../pull/12/files, .../pull/12#issuecomment-1, ?w=1,
// in any letter case. Returns the clean form "<repoUrl>/pull/12", or null if it isn't a PR in that repo.
export function cleanPullRequestUrl(repoUrl, url) {
  const repo = repoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = url.trim().match(new RegExp(`^${repo}/pull/(\\d+)(?:/[\\w-]*)*/?(?:[?#].*)?$`, 'i'));
  return match ? `${repoUrl}/pull/${match[1]}` : null;
}
