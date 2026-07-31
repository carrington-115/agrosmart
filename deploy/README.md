# Deployment

## Local

```bash
# Both services against your Supabase project.
export AGRO_DATABASE_URL='postgresql://agro_api:...@db.<ref>.supabase.co:5432/postgres'
export AGRO_SUPABASE_URL='https://<ref>.supabase.co'
export AGRO_TOKEN_PEPPER="$(openssl rand -hex 32)"
export NEXT_PUBLIC_SUPABASE_URL="$AGRO_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_...'

docker compose up --build

# Throwaway Postgres for `pytest -m integration`.
docker compose --profile test up -d db
```

The compose file uses `${VAR:?message}` rather than defaults, so a missing
variable fails immediately with the variable's name instead of silently
connecting somewhere unintended.

## Kubernetes

```
deploy/k8s/
├── base/              environment-independent; not deployable on its own
└── overlays/
    ├── local/         minikube: in-cluster Postgres, local images, no TLS
    └── prod/          GHCR images, real hostnames, TLS
```

### Production

```bash
kubectl apply -k deploy/k8s/overlays/prod
```

Create the secret out of band first. Base deliberately declares **no** Secret, so
a missing one is a loud `CreateContainerConfigError` rather than a pod that
starts with empty configuration:

```bash
kubectl -n agrosmart create secret generic agroapi-secrets \
  --from-literal=AGRO_DATABASE_URL='postgresql://agro_api:...@db.<ref>.supabase.co:5432/postgres' \
  --from-literal=AGRO_TOKEN_PEPPER="$(openssl rand -hex 32)"
```

> It used to be committed as a `REPLACE_ME` template *and* included in the
> kustomization, which meant following these very instructions and then running
> `apply -k` overwrote the real credentials with the literal string
> `REPLACE_ME`. If you are tempted to add it back for convenience, that is why
> it is not there.

Production also needs, and this repo does not create: a **GHCR image-pull
secret** (published packages are private — anonymous pull returns `401`),
ingress-nginx, cert-manager with a `letsencrypt-prod` ClusterIssuer, and DNS.

### Local, on minikube

```bash
minikube start
minikube addons enable ingress metrics-server

bash deploy/k8s/overlays/local/build-images.sh   # builds INTO the cluster's daemon
bash deploy/k8s/overlays/local/apply.sh

kubectl -n agrosmart get pods -w
```

Reach it — minikube's docker driver puts the node IP on a network the Windows
host cannot route, so port-forward rather than using `minikube ip`:

```bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8081:80
curl -H 'Host: agrosmart.local'     http://127.0.0.1:8081/          # 307 → /auth
curl -H 'Host: api.agrosmart.local' http://127.0.0.1:8081/v1/health # 200
```

Tear down with `kubectl delete namespace agrosmart`.

**Watch the backend gate itself on the schema.** It starts before the `migrate`
Job has run, fails readiness because `check_schema` finds the `0002` columns
missing, and stays out of its Service until the Job completes. Nothing waits on
anything — the readiness contract does the sequencing. That is the production
failure mode being rehearsed: deployed against a database where the migration
was never pushed.

### Three traps this layer has already fallen into

**Build into minikube's daemon, never `minikube image load`.** `image load`
silently keeps an existing image of the same tag, so a rebuild after a source
change leaves the cluster running the *old* code — no error, no warning, and a
traceback pointing at a line number that no longer exists. `build-images.sh`
uses `minikube docker-env` so there is only ever one copy.

**Migration filenames sort under C collation in the container.** `_` (0x5F) is
greater than every digit, so `00_auth_stub.sql` ran *after* `0001_init.sql` and
died on the missing `auth.users` — while sorting first on a dev machine, where
locale-aware collation ignores punctuation. Hence `0000_auth_stub.sql`, and an
explicit `LC_ALL=C` in the Job.

**A ConfigMap value is a plain string.** `AGRO_CORS_ORIGINS` is a list, and
pydantic-settings decoded it as JSON inside the settings source, before any
validator could run — every pod crash-looped at import. `config.py` now marks
the field `NoDecode` and splits on commas.

## Five decisions worth knowing before you change something

**1. The backend starts even when the database is down.**
`AGRO_DB_POOL_MIN_SIZE` is `0`, so the pool connects lazily. A non-zero value
makes `create_pool()` open connections during startup, which turns an unreachable
Supabase into a *startup* failure — and in Kubernetes that is a crash-loop during
a transient blip. Instead the pod stays up and reports itself **unready**, so the
readiness probe withholds traffic without the pod dying.

**2. Liveness and readiness answer different questions.**
`/v1/health` touches nothing external. `/v1/health/ready` checks the database, the
JWKS endpoint and the schema write contract. Failing liveness restarts a pod;
failing readiness only removes it from the Service. Putting the database in the
liveness probe would convert an outage into an outage plus a reconnect storm.

**3. Readiness includes a schema check, and that is not paranoia.**
Migrations are applied by the Supabase CLI while this service deploys separately,
so "running against a database where the migration was never pushed" is a real
and otherwise silent failure mode. It would surface as every ingest 500ing with a
Postgres error in a log nobody is reading. Only the columns the ingest writer
writes are asserted — a full schema diff would duplicate the migrations and rot.

**4. `NEXT_PUBLIC_*` are build arguments, not runtime environment.**
Next inlines them into the client bundle at build time. Setting them in a
ConfigMap does nothing; changing one means rebuilding the image. That is why
`deploy/k8s/base/agroapp.yaml` has no config for them, and why
`agroapp/Dockerfile` takes them as `ARG`.

`SUPABASE_SERVICE_ROLE_KEY` must never appear in either — it bypasses RLS, and a
build arg bakes it into an image layer.

**5. No CPU limit on the backend, and the replica ceiling is about Postgres.**
CFS throttling on an asyncio service shows up as latency spikes that look exactly
like database slowness and are miserable to diagnose. The CPU *request* handles
scheduling.

The HPA stops at 6 replicas because each opens up to `AGRO_DB_POOL_MAX_SIZE`
connections: 6 × 10 = 60 against Supabase's limit is the real constraint, not CPU
headroom. Raise one and you must recheck the other.

## What the local run does and does not prove

Verified on minikube: readiness gates on the schema and names the missing column;
a database outage makes pods unready with **zero restarts**; both ingress hosts
route correctly; a rolling restart never drops below 2 ready endpoints; both
containers run as uid 10001 on a read-only root filesystem; the HPA reports real
CPU metrics.

Not proven, and worth knowing:

- **NetworkPolicy is not enforced.** minikube's default CNI ignores it — measured,
  not assumed: `agroapp` opens a connection to `postgres:5432` that the
  default-deny should refuse. Use `minikube start --cni=calico` to exercise it.
- **PodDisruptionBudgets are computed but not exercised.** `kubectl get pdb`
  shows the right protection (`agroapp` allows 0 disruptions), but a single-node
  drain aborts on an unrelated kube-system pod before reaching them.
- **TLS and cert-manager are untested** — the local overlay strips both.

## Ports

`8080` is not arbitrary. `agrosensor/include/config.h` sets
`AGRO_INGEST_URL "http://192.168.1.100:8080/api/ingest"`, so a node flashed
against a local instance needs no firmware change beyond the path.
