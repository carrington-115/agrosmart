#!/usr/bin/env bash
# Builds both images and side-loads them into minikube.
#
#   bash deploy/k8s/overlays/local/build-images.sh
#
# GHCR cannot be used locally: published packages are private by default, so an
# anonymous pull returns 401 and every pod sits in ImagePullBackOff.
#
# This builds STRAIGHT INTO minikube's docker daemon rather than building on the
# host and running `minikube image load`. That is not a preference — `image load`
# silently keeps an existing image of the same tag, so rebuilding after a source
# change leaves the cluster running the OLD code with no error and no warning.
# Even `minikube image rm` first did not reliably shift it. It cost a full
# debugging cycle: the pod kept crashing on a bug that was already fixed, and the
# traceback pointed at a line number that no longer existed in the source.
#
# Building in the cluster's own daemon means there is only ever one copy, so it
# cannot go stale.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="$(cd ../../../.. && pwd)"

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so agroapp
# needs them now — passing them at runtime would have no effect. Read from
# .env.local, which is gitignored; both values are publishable by design.
ENV_FILE="$REPO_ROOT/agroapp/.env.local"
read_env() { awk -F= -v k="$1" '$1==k {sub("^"k"=",""); print; exit}' "$ENV_FILE" | tr -d '\r "'"'"''; }

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(read_env NEXT_PUBLIC_SUPABASE_URL)}"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-$(read_env NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "error: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY," >&2
  echo "       or provide them in $ENV_FILE" >&2
  exit 1
fi

# Point docker at the cluster's daemon for the rest of this script only. It is a
# subshell environment change, so the caller's shell is untouched.
echo "==> targeting minikube's docker daemon"
eval "$(minikube docker-env --shell bash)"
echo "    DOCKER_HOST=$DOCKER_HOST"

echo "==> building agroapi:local"
docker build -q -t agroapi:local "$REPO_ROOT/agroapi" >/dev/null

echo "==> building agroapp:local"
docker build -q -t agroapp:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_KEY" \
  "$REPO_ROOT/agroapp" >/dev/null

echo "==> done. Roll the pods so they pick the new images up:"
echo "     kubectl -n agrosmart rollout restart deploy/agroapi deploy/agroapp"
