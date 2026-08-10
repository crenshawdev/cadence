# Anthropic plugin store / marketplace submission — research brief (2026-07-17)

Untracked working note. Sourced by a research subagent from current Claude Code docs
(code.claude.com/docs/en/plugins*.md) and the two Anthropic marketplace repos. Treat
"confirmed" tags as "confirmed against those URLs at research time," re-verify before acting.

## The key correction to our assumption

There are TWO official marketplaces, and neither matches "fill an application, hand-reviewed by engineers" exactly:

1. **`anthropics/claude-plugins-official`** — Anthropic-curated. **No application process.**
   Anthropic decides what to include at its discretion. You cannot apply; you get invited by
   being good and visible. The submission form does NOT add to the official marketplace.
2. **`anthropics/claude-plugins-community`** — accepts third-party submissions via a web form,
   gated by **automated** safety screening + validation (not hand review by engineers, per docs).
   Approved plugins are pinned to a commit SHA in the community repo; CI bumps the pin as you push.

Strategy implication: the realistic path is a clean **community** submission. Doing that
excellently (validate clean, complete metadata, strong docs) is also what maximizes the odds
Anthropic notices us for the discretionary **official** curation. The "make it goddamn good"
bar still applies — it's just earned via quality/visibility, not an application to hand-reviewers.

## Community submission process

- Portal: https://clau.de/plugin-directory-submission (web form)
- Local gate before submitting: `claude plugin validate [path] [--strict]` (also `/plugin validate`)
- Flow: form -> automated safety screening + validation -> approved -> pinned to a commit SHA in
  claude-plugins-community -> nightly catalog sync. `--strict` treats warnings as errors (good CI gate).

## What validation / acceptance checks

- `plugin.json` schema compliance; skill/agent/command frontmatter YAML; `hooks/hooks.json` syntax;
  marketplace entry structure; kebab-case naming (warning-level).
- Automated safety screening inspects MCP server defs (what external tools run), hook configs
  (what shell commands run), manifest metadata. Exact checks not published.
- Quality standards documented but not itemized ("must meet security and quality standards").

## Manifest requirements

plugin.json — required: `name` (kebab-case). Recommended for a strong submission:
`displayName`, `description`, `version` (semver), `author {name,email?}`, `homepage`,
`repository`, `license` (SPDX), `keywords`.

marketplace.json — required: `name`, `owner {name}`, `plugins[]`. Optional: `description`,
`version`, `$schema`. Per-plugin entry: `name` + `source` required; description/version/author/
homepage/repository/license/keywords/category/strict/defaultEnabled/displayName optional.

## Cadence submission checklist (from the brief)

1. plugin.json `name` is kebab-case (`cadence`).
2. `claude plugin validate --strict` clean — no errors, ideally no warnings.
3. Complete metadata: displayName, description, author, homepage, repository, license, keywords.
4. README.md with usage examples + CHANGELOG.md with version history.
5. Version is proper semver and matches the release tag (ties into our 1.0.0 -> 1.1.0 bump).
6. Submit the form at clau.de/plugin-directory-submission; wait for automated screening.

## Open questions (unconfirmed in docs)

Exact safety checks; review/approval timeline; post-approval rejection; whether plugin.json vs
marketplace.json version mismatch causes rejection (validator warns; one non-Anthropic source
claimed it's a rejection reason); dependency-CVE policy; size limits; official-marketplace
invite criteria (deliberately unpublished); dual-submission; rejection feedback loop.
