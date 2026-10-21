#!/usr/bin/env bash
# Vercel build for the shop: deploys the Convex backend to the deployment the
# studio's build uses (production, or the branch's preview), seeds it, then
# builds the shop against it, so the pages built ahead show the catalog.
set -euo pipefail
cd "$(dirname "$0")/.."

# `convex deploy` and `convex run` go wherever CONVEX_DEPLOY_KEY points, even
# past --preview-name, so a development key would quietly build the shop
# against another deployment than the studio's.
case "${VERCEL_ENV:-}:${CONVEX_DEPLOY_KEY:-}" in
  production:prod:* | preview:preview:*) ;;
  *)
    echo "CONVEX_DEPLOY_KEY must be a Convex ${VERCEL_ENV:-production or preview} deploy key, as jolene-studio's is." >&2
    exit 1
    ;;
esac

# Both projects build every push and deploy the same functions to the same
# deployment; a deploy that fails, such as one meeting the studio's, is tried
# again.
url_file="$(mktemp)"
for attempt in 1 2 3; do
  if npx convex deploy \
    --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
    --cmd "printenv NEXT_PUBLIC_CONVEX_URL > $url_file"; then
    break
  fi
  if [ "$attempt" = 3 ]; then exit 1; fi
  sleep $((attempt * 20))
done
NEXT_PUBLIC_CONVEX_URL="$(cat "$url_file")"
export NEXT_PUBLIC_CONVEX_URL

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

cd ../.. && bunx turbo run build --filter=@jolene/shop
