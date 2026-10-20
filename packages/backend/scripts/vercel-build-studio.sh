#!/usr/bin/env bash
# Vercel build for the studio: deploys the Convex backend (production, or one
# preview deployment per branch), then builds the studio against it.
#
# Every branch preview and every release then seeds the deployment it deployed
# to (init:seed): the collections live in code, and seeding again brings a
# deployment up to date with them, so one created before a collection changed
# catches up on its next build; `convex deploy --preview-run` would only reach
# a preview the first time it's created.
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
elif [ "${VERCEL_ENV:-}" = "production" ]; then
  # The production deploy key in CONVEX_DEPLOY_KEY reaches production only.
  npx convex run --typecheck disable --codegen disable init:seed
fi
