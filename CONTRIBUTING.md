# Contributing to Cadence

Read the [MANIFESTO](./MANIFESTO.md) first. Cadence is one person's tool, built to say no, and that shapes what a contribution here looks like. This is not the usual open invitation to grow the thing. The whole point is that it stays small.

Here is the honest version. Bug reports are welcome and I want them. If a script throws, a hook misfires, a command does the wrong thing, or a doc claims something the code doesn't do, open an issue with the receipts and I will chase it. Doc fixes too, a typo, a broken link, a stale path the CI didn't catch, send the pull request and those land fast.

Feature pull requests are a different story. Every feature is a thing that can fail, and the surface I never build is the only surface that never betrays me. So a change that adds a command, a config key, an agent, or a whole new track is starting from behind. Not because the idea is bad, but because the default answer to "should Cadence do one more thing" is no, and it has to be, or the tool turns back into the elephant I forked it away from. If you have a case anyway, open an issue and make it before you write the code, so neither of us burns an afternoon on a patch I was always going to decline.

Fork freely. The license is MIT and it means it. If you want Cadence to hold something it refuses to hold, the right move is your fork, not my `main`, and I would rather you run a tool that fits your hand than bend mine out of shape trying to fit everyone's.

## Running the checks

Cadence has no build step and no dependencies. The scripts inside are zero-dependency Node, so there is no `npm install`. The same three checks CI runs, you can run locally with `node` and `git` on your PATH:

```
node --test cadence-core/bin/*.test.mjs   # unit tests for the seam cores
node cadence-core/bin/self-verify.mjs     # the prose<->code drift linter
npx tsc -p tsconfig.ci.json               # honor the @ts-check pragmas
```

The self-verify step is the one that catches most drift. It lints the prose against the code: every config key, script invocation, and file path named in the workflows has to actually exist, or the build fails. It also weighs every agent, skill, and workflow surface and fails when one outgrows its byte budget, or when an agent's prose reaches for a tool its frontmatter never declared. If you touch a command or a config key, run it before you push, because the build will run it for you either way.

## What a good bug report has

The failing command, what you expected, what happened instead, and enough of the surrounding state to reproduce it: your Claude Code version, `node --version`, and the relevant slice of `.planning/` or config if the bug is state-shaped. A stack trace beats a paraphrase every time.

## Attribution

Cadence is a derivative work of [GSD](https://github.com/open-gsd/gsd-core), used under the MIT License, and the lineage is spelled out in [`NOTICE.md`](./NOTICE.md) and [`LINEAGE.md`](./LINEAGE.md). Contributions land under the same MIT License the rest of the repo carries.
