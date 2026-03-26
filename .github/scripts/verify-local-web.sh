#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

grep -Fq 'export const OPENCODE_WEB_APP_URL = process.env["OPENCODE_WEB_APP_URL"]' packages/opencode/src/flag/flag.ts
grep -Fq 'const appUrl = Flag.OPENCODE_WEB_APP_URL || "https://app.opencode.ai"' packages/opencode/src/server/server.ts
grep -Fq 'icon: `${location.origin}/favicon-96x96-v3.png`' packages/app/src/entry.tsx
grep -Fq 'src={props.project.id === OPENCODE_PROJECT_ID ? "/favicon.svg" : props.project.icon?.override}' packages/app/src/pages/layout/sidebar-items.tsx
grep -Fq 'typeof location === "object" && location.hostname.includes("opencode.ai") ? "https://opencode.ai/changelog.json" : ""' packages/app/src/context/highlights.tsx
