#!/usr/bin/env bash
# Runs inside `convex deploy --cmd`, with NEXT_PUBLIC_CONVEX_URL pointing at the
# deployment just pushed. Previews get their own studio URL as SITE_URL, which
# Convex Auth uses for sign-in redirects.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "preview" ] && [ -n "${VERCEL_BRANCH_URL:-}" ] && [ -n "${VERCEL_GIT_COMMIT_REF:-}" ]; then
  # `convex deploy` names a preview after its branch, and the preview deploy key
  # in CONVEX_DEPLOY_KEY reaches it by that name.
  npx convex env set --preview-name "$VERCEL_GIT_COMMIT_REF" \
    SITE_URL "https://$VERCEL_BRANCH_URL/studio"
fi

cd ../.. && bunx turbo run build --filter=@jolene/studio
