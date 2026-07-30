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

```bash
kubectl apply -k deploy/k8s
```

Create the secret out of band first — the committed manifest is a template with
`REPLACE_ME` values, and a real one must never be committed:

```bash
kubectl -n agrosmart create secret generic agroapi-secrets \
  --from-literal=AGRO_DATABASE_URL='postgresql://agro_api:...@db.<ref>.supabase.co:5432/postgres' \
  --from-literal=AGRO_TOKEN_PEPPER="$(openssl rand -hex 32)"
```

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
`deploy/k8s/agroapp.yaml` has no config for them, and why `agroapp/Dockerfile`
takes them as `ARG`.

`SUPABASE_SERVICE_ROLE_KEY` must never appear in either — it bypasses RLS, and a
build arg bakes it into an image layer.

**5. No CPU limit on the backend, and the replica ceiling is about Postgres.**
CFS throttling on an asyncio service shows up as latency spikes that look exactly
like database slowness and are miserable to diagnose. The CPU *request* handles
scheduling.

The HPA stops at 6 replicas because each opens up to `AGRO_DB_POOL_MAX_SIZE`
connections: 6 × 10 = 60 against Supabase's limit is the real constraint, not CPU
headroom. Raise one and you must recheck the other.

## Ports

`8080` is not arbitrary. `agrosensor/include/config.h` sets
`AGRO_INGEST_URL "http://192.168.1.100:8080/api/ingest"`, so a node flashed
against a local instance needs no firmware change beyond the path.
