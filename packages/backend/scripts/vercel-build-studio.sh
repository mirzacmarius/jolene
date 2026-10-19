#!/usr/bin/env bash
# Vercel build for the studio: deploys the Convex backend (production, or one
# preview deployment per branch), then builds the studio against it.
#
# Every preview build then seeds the branch's preview deployment (init:seed).
# Seeding again replaces what it seeded before, so a preview created before a
# seeded collection changed catches up on its next build;
# `convex deploy --preview-run` would only reach a preview the first time it's
# created. Production stays unseeded until someone runs the seed there by hand.
set -euo pipefail
cd "$(dirname "$0")/.."

npx convex deploy \
  --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
  --cmd 'bash scripts/build-studio-for-deployment.sh'

if [ "${VERCEL_ENV:-}" = "preview" ] && [ -n "${VERCEL_GIT_COMMIT_REF:-}" ]; then
  # `convex deploy` names a Vercel preview deployment after its Git branch, and
  # the preview deploy key in CONVEX_DEPLOY_KEY lets `convex run` reach it.
  npx convex run --preview-name "$VERCEL_GIT_COMMIT_REF" \
    --typecheck disable --codegen disable \
    init:seed
fi
