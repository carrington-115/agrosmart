#!/usr/bin/env bash
# Applies the local overlay to whatever cluster kubectl currently points at.
#
#   bash deploy/k8s/overlays/local/apply.sh
#
# Two things this does that `kubectl apply -k` cannot do alone.
#
# 1. Builds the migration ConfigMap from agroapp/supabase/migrations/, which sits
#    outside this kustomize root. configMapGenerator refuses to read outside the
#    root without --load-restrictor LoadRestrictionsNone, and `kubectl apply -k`
#    does not accept that flag. Copying the SQL in here instead would create a
#    second copy that drifts from the real schema, and a test against a drifted
#    migration is worse than no test.
#
# 2. Deletes a completed migrate Job before re-applying. A Job's pod template is
#    immutable, so a second apply with any change to it fails outright.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="$(cd ../../../.. && pwd)"
MIGRATIONS="$REPO_ROOT/agroapp/supabase/migrations"
NS=agrosmart

echo "==> namespace"
# The ConfigMap below needs the namespace to exist first, and it is created by the
# same kustomize build that consumes the ConfigMap — so it is applied on its own
# up front to break that ordering loop.
kubectl apply -f ../../base/namespace.yaml

echo "==> migration ConfigMap (from $MIGRATIONS)"
# 0000_auth_stub.sql stands in for the Supabase-only auth schema that 0001
# references. Filename order is the apply order, under C collation — see
# migrate-job.yaml, and the header of the stub for why the name starts 0000.
kubectl create configmap agro-migrations -n "$NS" \
  --from-file=0000_auth_stub.sql \
  --from-file="$MIGRATIONS" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> clearing any previous migrate Job"
kubectl delete job migrate -n "$NS" --ignore-not-found --wait=true

echo "==> applying overlay"
kubectl apply -k .

cat <<'EOF'

==> applied.

Watch the backend gate itself on the schema — it stays unready until the migrate
Job finishes, which is the behaviour worth seeing:

  kubectl -n agrosmart get pods -w

Reach the ingress (minikube's docker driver puts the node IP on a network the
Windows host cannot route, so port-forward rather than using `minikube ip`):

  kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8081:80
  curl -H 'Host: agrosmart.local'     http://127.0.0.1:8081/
  curl -H 'Host: api.agrosmart.local' http://127.0.0.1:8081/v1/health

Tear down:

  kubectl delete namespace agrosmart
EOF
