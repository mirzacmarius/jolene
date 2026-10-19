#!/usr/bin/env bash
# Runs inside `convex deploy --cmd`, with NEXT_PUBLIC_CONVEX_URL pointing at the
# deployment just pushed. Previews get their own studio URL as SITE_URL, which
# Convex Auth uses for sign-in redirects.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "preview" ] && [ -n "${VERCEL_BRANCH_URL:-}" ]; then
  deployment="$(basename "$NEXT_PUBLIC_CONVEX_URL" .convex.cloud)"
  npx convex env set --deployment "$deployment" SITE_URL "https://$VERCEL_BRANCH_URL/studio"
fi

cd ../.. && bunx turbo run build --filter=@jolene/studio
