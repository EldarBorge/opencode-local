# OpenCode Local

`opencode-local` is a minimal fork of [`anomalyco/opencode`](https://github.com/anomalyco/opencode).

It exists for one reason:

- remove the mandatory hosted web/runtime dependencies from OpenCode's browser UI, so the core web experience can be self-hosted without opening egress to `app.opencode.ai`, `api.opencode.ai`, or `models.dev`

This fork is intentionally narrow. It is not a rebrand, not a distro, and not a homelab-specific fork. The binary is still `opencode`, and almost all product behavior should stay aligned with upstream.

## What Changes Here

- `OPENCODE_WEB_APP_URL` is supported as a configurable fallback shell target for `opencode web`
- the browser UI uses local favicon/notification assets instead of hosted asset URLs
- the hosted changelog is no longer fetched by default outside `opencode.ai`
- the fork automation keeps tracking upstream instead of freezing on one old tag

## What Does Not Change Here

- auth strategy
- model provider choices
- deployment manifests
- package mirrors or workstation tooling
- upstream docs, branding, or ecosystem links unless they are required for the web UI to function

## Channels

- `main`: patched upstream `dev`
- `stable`: patched latest upstream release tag
- `vX.Y.Z-local.1`: patched release tags created from upstream releases

If you want the newest upstream code with the local-web patches, use `main`.

If you want the newest upstream stable release with the same patch set, use `stable` or the latest `vX.Y.Z-local.1` release.

This fork currently automates source branches and GitHub releases. It does not claim to replace upstream npm, Homebrew, desktop, or other package distribution channels.

## Automation

GitHub Actions keeps this fork current:

- fetch upstream `dev` and tags
- rebuild `main` from upstream `dev` plus the patch queue
- rebuild `stable` from the latest upstream release tag plus the same patch queue
- create or update the matching `vX.Y.Z-local.1` GitHub release
- open or refresh a drift issue when the patch queue stops applying cleanly
- close that drift issue again after a later successful sync

If the patch queue stops applying cleanly, the sync job fails instead of silently drifting.

## Upstream

- upstream repo: [`anomalyco/opencode`](https://github.com/anomalyco/opencode)
- this fork tries to stay easy to diff and easy to upstream

If upstream accepts these changes, this fork should shrink or disappear.
