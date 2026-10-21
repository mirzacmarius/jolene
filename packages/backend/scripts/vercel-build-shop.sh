#!/usr/bin/env bash
# Vercel build for the shop: deploys the Convex backend to the deployment the
# studio's build uses (production, or the branch's preview), seeds it, tells
# it the shop's address, then builds the shop against it, so the pages built
# ahead show the catalog. A production build then copies the catalog's photos
# to the photo store.
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
  # the preview deploy key in CONVEX_DEPLOY_KEY reaches it by that name.
  deployment=(--preview-name "$VERCEL_GIT_COMMIT_REF")
  # Vercel also builds a preview of main, and gives it no branch URL.
  shop_url="https://${VERCEL_BRANCH_URL:-$VERCEL_URL}"
elif [ "${VERCEL_ENV:-}" = "production" ]; then
  # The production deploy key in CONVEX_DEPLOY_KEY reaches production only.
  deployment=()
  shop_url="https://$VERCEL_PROJECT_PRODUCTION_URL"
fi

if [ -n "${shop_url:-}" ]; then
  npx convex run "${deployment[@]}" --typecheck disable --codegen disable init:seed

  # Stripe sends couples back to the shop, and order emails link to it, at
  # SHOP_URL: the address of this build. Production keeps one it already has,
  # so it can be set by hand, as https://jolene.ro once that serves the shop.
  names="$(npx convex env list --names-only "${deployment[@]}")"
  if [ "$VERCEL_ENV" = "preview" ] || ! grep -qx SHOP_URL <<<"$names"; then
    npx convex env set "${deployment[@]}" SHOP_URL "$shop_url" >/dev/null
  fi
fi

cd ../.. && bunx turbo run build --filter=@jolene/shop

# A production build copies the catalog's photos the photo store lacks
# (ADR 0016), once the store is connected to the shop's project. One that
# fails, or that the quarter of an hour leaves, is copied by the next
# production build, so the copy never stops a release.
if [ "${VERCEL_ENV:-}" = "production" ] &&
  [ -n "${BLOB_READ_WRITE_TOKEN:-}${BLOB_STORE_ID:-}" ]; then
  bun packages/products/scripts/photos.ts --minutes 15 ||
    echo "Some of the catalog's photos weren't copied; the next production build tries them again." >&2
fi
