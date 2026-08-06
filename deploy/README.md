# Deployment

## Development

```bash
cp .env.example .env    # then fill it in; compose reads it automatically
docker compose -f docker-compose.dev.yml up --build
```

Hot reload on both sides — `uvicorn --reload` over a read-only mount of
`agroapi/src`, `next dev` over a bind-mounted `agroapp`. Then:

```bash
curl -s localhost:3000/api/dev/backend | jq   # no session needed
```

`http://localhost:3000/dev/backend` renders the same probe in the browser, behind
the usual auth redirect.

**This is the only thing in the repo that proves the two services are connected.**
They share a Supabase database, so both can look perfectly healthy while no HTTP
path between them exists at all — which was the case until `AGRO_API_URL` and
`agroapp/lib/api.ts` landed. The probe asks agroapi two questions from inside the
Next.js server: `/v1/health/ready`, and `POST /v1/ingest` with no credentials
expecting a 401. The second proves more than the first, because readiness would
answer even if every real route were unreachable.

Read the results this way:

| What you see | What it means |
|---|---|
| both checks pass | the connection works |
| readiness `503`, ingest `401` | connection fine; agroapi's schema or JWKS is unhappy — the readiness body names which |
| readiness `503`, ingest `500` | connection fine; agroapi cannot reach Postgres. Device auth resolves a service-scoped connection before it can reject a token, so a dead database surfaces as a 500 here rather than a 401 |
| `reachable: false` | no HTTP path. Wrong `AGRO_API_URL`, or agroapi is down |
| `error` naming `AGRO_API_URL` | it is unset. `lib/api.ts` refuses to guess a default, so this cannot be mistaken for an outage |

CORS is not involved in any of this. The probe runs server-side and sends no
`Origin` header, so `AGRO_CORS_ORIGINS` can be wrong without the probe noticing —
it governs the browser's direct calls to agroapi, of which there are currently
none.

### If the frontend does not hot-reload on Windows

Measured, so you do not have to guess: `uvicorn --reload` **does** see edits
across a Docker Desktop bind mount rooted in `C:\Users\...\OneDrive\...` — editing
a file under `agroapi/src` restarts the container's server process. The Next side
is the one to distrust; Turbopack watches a far larger tree, and file-change
events over that mount are not guaranteed. It is a filesystem limitation, not
something to work around in the app.

If edits stop taking effect, run the backend in Docker and the frontend on the
host:

```bash
docker compose -f docker-compose.dev.yml up agroapi
cd agroapp && AGRO_API_URL=http://localhost:8080 pnpm dev
```

The address changing between the two modes is the argument for `AGRO_API_URL`
being a plain runtime variable rather than a `NEXT_PUBLIC_` build arg — one image
that reads its backend's location, not one image per place it might be.

## Local

```bash
# Production images, both services, against your Supabase project.
cp .env.example .env
docker compose up --build

# Throwaway Postgres for `pytest -m integration`. Needs no configuration at all.
docker compose -f docker-compose.test.yml up -d db
```

`docker-compose.yml` and `docker-compose.dev.yml` use `${VAR:?message}` rather
than defaults, so a missing variable fails immediately with the variable's name
instead of silently connecting somewhere unintended.

The test database is a third file rather than a profile in the first one for that
same reason: Compose interpolates a whole file before selecting services, so those
guards fired even when only `db` was requested, and the integration suite could not
be started on a clean checkout without inventing credentials for services it does
not use.

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

  This has a live consequence for the frontend cutover, which is why it is worth
  reading before that work starts. `base/ingress.yaml` declares
  `default-deny-ingress` and then opens agroapi only to the `ingress-nginx`
  namespace, so **`agroapp` cannot reach the `agroapi` pod**. Nothing depends on
  that path yet — `deploy/k8s/base/agroapp.yaml` sets no `AGRO_API_URL`, and only
  the compose stacks wire the two together. The moment `lib/queries.ts` calls the
  backend, this layer needs an `allow-agroapp-to-agroapi` policy. Under the
  default CNI the local overlay will happily pretend otherwise, so the break would
  surface first in **production**.
- **PodDisruptionBudgets are computed but not exercised.** `kubectl get pdb`
  shows the right protection (`agroapp` allows 0 disruptions), but a single-node
  drain aborts on an unrelated kube-system pod before reaching them.
- **TLS and cert-manager are untested** — the local overlay strips both.

## Ports

`8080` is not arbitrary. `agrosensor/include/config.h` sets
`AGRO_INGEST_URL "http://192.168.1.100:8080/api/ingest"`, so a node flashed
against a local instance needs no firmware change beyond the path.
