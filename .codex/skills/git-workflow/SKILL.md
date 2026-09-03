---
name: git-workflow
description: Apply the Easy Clip issue, branch, commit, push, pull request, merge, cleanup, and history-rewrite workflow. Use before running git or gh commands, changing GitHub issue or pull-request metadata, or deciding branch names and commit or pull-request title formats.
---

# Easy Clip Git Workflow

## Core Rules

- Write commit messages, PR titles and bodies, and issue titles and bodies in Korean.
- Create an issue first and use the same issue number in the branch, commit, and PR.
- Inspect `git status --short --branch` and the current branch before changing repository state.
- Preserve existing user changes and never stage or modify unrelated files.
- For GitHub-related work, run any delegated agent with the smallest available model that can complete the task.
- Commit, push, create or merge a PR, and force-push only within the scope explicitly authorized by the user.
- Never expose secrets, environment files, or tokens in code, commits, PR bodies, or command output.

## Create an Issue

Classify the request and follow the corresponding template under `.github/ISSUE_TEMPLATE/`:

- Bug: `[bug] ` with `bug_report.yml`
- New feature: `[feature] ` with `feature_implementation.yml`
- Improvement or refactoring: `[improvement] ` with `improvement.yml`

Write the title and body in Korean. Do not set labels manually. Pass the inline body to `gh issue create --body` instead of creating a separate body file.

Include every required template field:

- Bug: problem, reproduction steps, actual result, expected result, and environment
- Feature: feature to implement
- Improvement: area to improve

Report the created issue number and URL.

## Create a Branch

- Use the English branch format `<type>/<issue-number>`.
- Examples: `feat/123`, `fix/124`, `chore/125`.
- Branch feature work from the latest `dev`.
- Create a separate release issue before promoting `dev` to `main`.
- Inspect uncommitted work and the target branch's remote state before switching or creating branches.

## Format Commit and PR Titles

Use exactly the same format for commit and PR titles:

```text
#<related-issue>/type(scope) : message
```

Examples:

```text
#120/fix(user) : 일본어·중국어 언어 설정 저장 허용
#122/docs(chore) : 저장소 지침을 역할별 스킬로 분리
```

Validate the title with this regular expression:

```regex
^#[1-9][0-9]*/(chore|feat|refactor|fix|docs|style|hotfix|release)\((chore|docs|test|auth|user|clip|folder|subscriptions|trash|setting)\) : .+$
```

- Put the related issue number first. Never substitute the PR number for the related issue number.
- Put exactly one space on both sides of the colon.
- Write a concise Korean imperative or change-oriented message.
- Do not use GitHub defaults such as `Merge pull request ...` or issue-template prefixes such as `[feature]` in commit or PR titles.
- Do not treat GitHub's automatic `(#PR-number)` suffix as part of the standard title. Set the squash subject explicitly when an exact title is required.

Allowed types:

- `chore`: Packages, configuration, CI, and other non-feature maintenance
- `feat`: New functionality
- `refactor`: Structural or performance improvement without behavior change
- `fix`: Bug fix
- `docs`: Documentation, repository guidance, and comments
- `style`: Non-functional formatting, naming, or file-layout cleanup
- `hotfix`: Urgent change that bypasses the normal release flow
- `release`: Versioning, tags, deployment, and `dev → main` promotion

Allowed scopes are `chore`, `docs`, `test`, `auth`, `user`, `clip`, `folder`, `subscriptions`, `trash`, and `setting`. If none fits, do not invent a new scope; ask the maintainer whether to extend the policy.

## Commit Changes

1. Inspect `git diff` and `git status` to confirm the change boundary.
2. Stage only explicitly in-scope files.
3. Inspect the staged diff again.
4. Compose the commit title from the related issue, type, scope, and Korean message.
5. Verify repository status and the resulting commit title.

If the user says not to commit, do not stage or commit.

## Create a PR

- Use `dev` as the base for feature PRs.
- Use `main` as the base and `dev` as the head for release PRs.
- Follow `.github/PULL_REQUEST_TEMPLATE.md`.
- Include a concise summary, the reason for the change, the linked issue, and local validation results.
- Record `pnpm lint`, `pnpm test`, and `pnpm test:e2e` when applicable.
- Never claim that an unexecuted validation passed.
- Use the standard title format for the PR title.
- Report the PR number, URL, base/head branches, and draft status.

## Push and Merge

- Before every push, reproduce the checks in `.github/workflows/ci.yml` locally. Point `DATABASE_URL` at an isolated local `test_db`; never run the CI migration against the data-bearing local application database or a production database.
  1. Run `pnpm install --frozen-lockfile`.
  2. Run `pnpm prisma generate` and `pnpm prisma migrate deploy`.
  3. Run `pnpm test`, `pnpm lint`, and `pnpm build`.
  4. Run `pnpm test:e2e` as well when the change affects an integration path, even though it is not currently a CI workflow step.
- `pnpm lint` currently includes `--fix`. Inspect the resulting diff, include only in-scope fixes, and rerun the affected checks before pushing.
- Do not push when a required local CI check fails or the isolated test database is unavailable. Report the failure and request direction if it cannot be resolved within the task scope.
- Inspect the remote difference, commit range, and working-tree state before pushing.
- Use `git push -u origin <branch>` for the first push.
- Merge feature PRs into `dev` after review and CI pass.
- Use a release issue and a `release(chore)` title for `dev → main` PRs.
- Before squash merging, confirm that the final subject exactly matches the standard title.
- If a merge commit is required, set its subject to the same standard title.
- Never force-push or rewrite public history without explicit approval.

## Rewrite Public History

When changing commit messages already published on `dev` or `main`:

1. Build a mapping of PR, related issue, old commit hash, and new title.
2. Refresh remote references and create backup branches or tags.
3. Rewrite the shared DAG for all affected branches in one operation while preserving topology and trees.
4. Verify authors, dates, tree hashes, and branch differences.
5. Inspect branch protection and force-push settings.
6. After explicit final approval, update all affected branches together with `--force-with-lease`.
7. Tell collaborators how to synchronize existing clones and provide the changed hashes.

Never run destructive commands such as `git reset --hard`, forced branch deletion, or force-push without confirming the exact target, impact, and recovery path.

## Clean Up Branches

When the maintainer says “브랜치 정리해줘”, use this sequence:

```bash
git checkout dev
git fetch -p
git pull origin dev
git branch -vv
git branch -vv | awk '/: gone]/{print $1}' | xargs git branch -D
```

Inspect the `[gone]` list before deletion and confirm that no branch contains unpreserved user work.

## Report Completion

- State the issue number and branch used.
- Show the resulting commit and PR title format.
- Distinguish executed validation from skipped validation.
- Provide URLs for created or updated issues and PRs.
- Explicitly state when no commit, push, or merge was performed.
