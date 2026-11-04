# Contributing

Bug reports and documentation corrections are welcome. Tell me what you ran, what you expected, what happened, and enough of the relevant state to reproduce it. Include the Claude Code and Node versions when they matter. Remove credentials and private project material before sharing logs.

For a feature, open an issue before writing the implementation. Cadence is intentionally a single-developer tool, and a useful idea doesn't automatically belong in its scope. Discussing that first saves both of us work.

The repository's [contribution guide](https://github.com/crenshawdev/cadence/blob/main/CONTRIBUTING.md) has the code checks, separate test-repository workflow and contribution policy. [GitHub issues](https://github.com/crenshawdev/cadence/issues) are the place for reproducible bugs; **#cadence** on the [jcrenshaw.dev Discord](https://jcrenshaw.dev/discord) is for discussion.

## Work on the book

The source is Markdown under `docs/guide/`. `SUMMARY.md` controls the navigation, and `docs/book.toml` configures the build. The files remain readable on GitHub.

With mdBook 0.5.4 installed, run from the repository root:

```sh
mdbook build docs
mdbook serve docs
```

The build writes `docs/book/`, which is ignored by Git. `serve` gives you a local preview. Review the rendered page as well as the Markdown, especially after changing tables or navigation.

Write from the reader's task. Explain what a command does, what it changes and what the result establishes. Link to implementation details when they help; a user shouldn't need the history of an internal parser to start a project.

Configuration descriptions must agree with the schema and the code that consumes the setting. A documented default isn't a promise that a workflow always takes that path: scope, authorization and overrides can change the result.

## Publishing the book

The documentation workflow builds pull requests. Its deployment job is restricted to `main`; it can run after a push there or a manual dispatch on that branch. It uploads only the generated book.

Before the first deployment, select **GitHub Actions** as the repository's Pages publishing source and review the `github-pages` environment's deployment rules. The workflow doesn't enable Pages itself. Use the deployment's reported URL once the site is live.

Contributions use the repository's MIT license.
