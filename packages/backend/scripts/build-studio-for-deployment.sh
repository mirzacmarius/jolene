#!/usr/bin/env bash
# Runs inside `convex deploy --cmd`, with NEXT_PUBLIC_CONVEX_URL pointing at the
# deployment the functions go to once the studio has built.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "preview" ]; then
  # `convex deploy` names a preview after its branch, and the preview deploy key
  # in CONVEX_DEPLOY_KEY reaches it by that name.
  deployment=(--preview-name "$VERCEL_GIT_COMMIT_REF")
  # Vercel also builds a preview of main, and gives it no branch URL: that one
  # signs in at its deployment's own URL.
  site_url="https://${VERCEL_BRANCH_URL:-$VERCEL_URL}/studio"
else
  deployment=()
  site_url="https://$VERCEL_PROJECT_PRODUCTION_URL/studio"
fi

# Convex Auth signs sessions with a key pair kept on the deployment, and sends
# sign-in redirects to SITE_URL. A deployment that has no keys yet, such as a
# new preview or production on its first build, gets a fresh pair and the
# studio's URL here; the keys go straight to Convex and are never printed.
names="$(npx convex env list --names-only "${deployment[@]}")"
if ! grep -qx JWKS <<<"$names"; then
  bun scripts/set-auth-keys.ts "$site_url" "${deployment[@]}"
fi

# A preview writes sign-in codes to its logs, where the team reads them to
# sign in, unless it has a Resend key to email them with (from the Convex
# project's default environment variables).
if [ "${VERCEL_ENV:-}" = "preview" ] && ! grep -qx AUTH_LOG_CODES <<<"$names"; then
  npx convex env set "${deployment[@]}" AUTH_LOG_CODES 1 >/dev/null
fi

cd ../.. && bunx turbo run build --filter=@jolene/studio
