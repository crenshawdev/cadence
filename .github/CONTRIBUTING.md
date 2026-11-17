# Contributing to Cadence

Read the [MANIFESTO](../docs/MANIFESTO.md) first. Cadence is one person's tool, built to say no, and that shapes what a contribution here looks like. This is not the usual open invitation to grow the thing. The whole point is that it stays small.

Here is the honest version. Bug reports are welcome and I want them. If a script throws, a hook misfires, a command does the wrong thing, or a doc claims something the code doesn't do, open an issue with the receipts and I will chase it. Doc fixes too, a typo, a broken link, a stale path the CI didn't catch, send the pull request and those land fast.

Feature pull requests are a different story. Every feature is a thing that can fail, and the surface I never build is the only surface that never betrays me. So a change that adds a command, a config key, an agent, or a whole new track is starting from behind. Not because the idea is bad, but because the default answer to "should Cadence do one more thing" is no, and it has to be, or the tool turns back into the elephant I forked it away from. If you have a case anyway, open an issue and make it before you write the code, so neither of us burns an afternoon on a patch I was always going to decline.

Fork freely. The license is MIT and it means it. If you want Cadence to hold something it refuses to hold, the right move is your fork, not my `main`, and I would rather you run a tool that fits your hand than bend mine out of shape trying to fit everyone's.

## Running the checks

Cadence has no build step and no runtime dependencies. The scripts inside are zero-dependency Node, nothing under `cadence-core/bin/` imports anything but `node:` builtins, and running Cadence never installs a package. The typecheck is the one exception, and it is a check rather than a dependency: CI installs both packages for the length of one job with `npm install --no-save --no-package-lock --ignore-scripts typescript @types/node` before it runs `node_modules/.bin/tsc`. Locally you need the same two — `npx` fetches `typescript` for you on first use, but not `@types/node`, and `tsconfig.ci.json` sets `"types": ["node"]`, so without it the check fails with `TS2688: Cannot find type definition file for 'node'`. Run the same install line once, or skip the third check. The tests live in their own repository, [cadence-tests](https://github.com/crenshawdev/cadence-tests), cloned into `tests/` at the commit `.github/tests-pin` names; `.gitignore` keeps that clone out of this repository. It is a plain clone, not a submodule: the plugin directory refuses a submodule set to `update = none`, and without that setting a plugin install pulls the suite into the user's plugin cache. A change that needs new or different tests lands them on cadence-tests' `main` first and moves `.github/tests-pin` to that commit in the same pull request, since CI and the release guard both run the suite at the pinned commit. The first two checks need nothing but `node` and `git` on your PATH:

```
git clone https://github.com/crenshawdev/cadence-tests tests  # once, on a fresh clone
git -C tests checkout "$(cat .github/tests-pin)"              # the pinned suite; fetch first when the pin moves
node --test tests/*.test.mjs                                  # unit tests for the seam cores (~25s)
node tests/test.mjs routing                                   # just one group (~6s)
node tests/test.mjs --list                                    # the groups and what each owns
node cadence-core/bin/self-verify.mjs                         # the prose<->code drift linter
npx tsc -p tsconfig.ci.json                                   # checkJs over cadence-core/bin, tests excluded
```

The self-verify step is the one that catches most drift. It lints the prose against the code: every config key, script invocation, and file path named in the workflows has to actually exist, or the build fails. It also weighs every agent file, every SKILL.md, every workflow, and every file under `cadence-core/references/` and `cadence-core/templates/`, and fails when one EXCEEDS its recorded byte count in `cadence-core/bin/weight-budgets.json`, or when an agent's prose reaches for a tool its frontmatter never declared. The budget is a ceiling, not an equality: a surface you shrank is green, and its entry can be re-pinned whenever it suits you. If you touch a command or a config key, run it before you push, because the build will run it for you either way.

## Writing tests

A test has to earn its place, same as a feature. Before you write one, work out the outcomes and the realistic failures the change actually has, look at what the suite already covers, and add the smallest set of checks that proves the rest. If the fixtures or the setup outgrow the change, simplify the approach before you build it.

Test behavior through the seams, with expected values that come from the design and not from the code under test. A test that only finds a filename in a workflow, or a paragraph in a certain order, checks the prose, it doesn't prove a model follows that prose, so don't offer it as proof.

Stop when the agreed behavior is covered and the suite, self-verify, the typecheck and the coverage gate all pass. Expand only for a demonstrated defect, an uncovered acceptance requirement, or a measured coverage shortfall, name the gap, and use the smallest check that closes it. Another imaginable failure or another way the code could have been written is not a reason, and a review doesn't reopen finished testing without one of those three.

If the coverage gate comes up short, measure first and report the real gap. The gate stays at 95 lines and 88 branches, and what you add has to assert behavior, not just run lines. If closing the gap would cost far more than the change planned for, say so once in the pull request instead of growing the work or lowering the gate.

## Seam arguments

- A flag declares a DISPOSITION, not merely a type: what the seam does when the
  value is wrong, chosen from exactly three words - refuse, warn, fall back. All
  three are positions this tree already holds, so a contract that made every
  typed flag refuse would reverse two of them. `issue-check.mjs` falls back to a
  constant on a malformed `--timeout-ms`, because that seam's whole contract is
  that it never fails a land; `route.mjs` warns on a `--phase` outside the
  accepted shape and still resolves, because refusing there would route the
  phase LOWER than its own risk baseline; the `--dir` family refuses.
- Falling back means the flag reads as ABSENT and the caller's own default
  answers. The token after it is never consulted, which is what stopped a
  valueless `--branch` from reading the following `--dir` as a branch name.
- The BARE form's disposition is declared SEPARATELY from the value's, in its
  own field, because one function body in `planning.mjs` already runs both
  side by side. In the body shared by `trace append` and `trace close`, a bare
  `--step`, `--reviewer`, `--trigger` or `--role` refuses, while a bare
  `--plan`, `--sha` or `--base` is dropped. One word for both axes would
  either start refusing every shipped close that omits `--plan`, or extend the
  drop to the refusals written against exactly the complete-looking event that
  defeats attribution: a bare `--role` wrote a record with no role key, and the
  renderer then aggregated it under the empty string. The two axes differ on
  ordinary flags too - `release-bump.mjs`'s `--version` refuses a blank value
  and falls back on a bare one.
- A new seam DECLARES its flags in `cadence-core/bin/lib/arg-contract.mjs`, one
  row per flag carrying all four fields (`required`, `type`, `value`, `bare`),
  rather than restating the rules in a parser of its own. That same table is
  what self-verify checks documented invocations against, so a flag with no row
  is a flag no prose may spell.
- The contract CLASSIFIES and the CALLER owns its own `reason` string, which is
  why one `--dir` rule surfaces under two names: `planning.mjs` reads the
  classification back and refuses with `bad-args`, the single refusal vocabulary
  that file publishes, while the seams that end in an `e.seam` catch arm raise
  it and refuse with `missing-flag-value`. The module mints no reason code of
  its own, so adopting it adds nothing to a seam's published list.
- The DECLARATION is what refuses. An adopting bin runs its resolved row at the
  door of its dispatch rather than restating the rule at each handler, and
  `arg-contract-adoption.test.mjs` (cadence-tests repository) walks the whole table
  against the shipped binaries, so a row declaring a refusal nothing carries out
  reddens there. That census is what the gap needed: 98 rows were declared for
  one script and two of them were read, so a valueless flag wrote the boolean
  `true` into a cursor, a checklist's front-matter and a recorded UAT result.
- PRESENCE is the stated exception. The shared door judges only the flags a
  caller actually PASSED, and a flag that is genuinely ABSENT is answered by the
  bin that owns the wording, because the diagnostic for a missing enum-valued
  flag - which of three kinds a capture is, which of two modes a prune takes -
  is not expressible in a declaration. So `required` records a fact for the bins
  that choose to read it, never a rule the door enforces.
- The contract governs VALUE grammar only, and never refuses an UNDECLARED flag
  at runtime. Membership is the prose-side lint's job, so a flag missing from
  the table is caught where prose spells it rather than at a caller's expense.

## Authoring style (for new workflows)

- Structure: `<purpose>`, `<process>` with named `<step>`s, `<guardrails>`,
  `<success_criteria>`. Match the tone and density of cadence-core/workflows/task.md.
- No multi-runtime branches, no CC-bug-number workaround prose, no ASCII
  banner variants. Plain instructions.

## What a good bug report has

The failing command, what you expected, what happened instead, and enough of the surrounding state to reproduce it: your Claude Code version, `node --version`, and the relevant slice of `.planning/` or config if the bug is state-shaped. A stack trace beats a paraphrase every time.

## Attribution

Cadence is a derivative work of [GSD](https://github.com/open-gsd/gsd-core), used under the MIT License, and the lineage is spelled out in [`NOTICE.md`](../NOTICE.md) and [`LINEAGE.md`](../docs/LINEAGE.md). Contributions land under the same MIT License the rest of the repo carries.
