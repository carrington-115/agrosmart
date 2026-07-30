# AgroSmart backend.
#
# Two stages so the runtime image carries no build tooling: uv, compilers and the
# lockfile all stay behind in the builder. The result is python:slim plus a
# virtualenv.

# ---------------------------------------------------------------- build
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

# Must be the SAME path the runtime stage uses. The console scripts uv installs
# (.venv/bin/uvicorn) carry an absolute shebang pointing at .venv/bin/python, so
# building at /build and copying to /app leaves every entry point pointing at a
# path that no longer exists — which surfaces as the memorably unhelpful
# "exec /app/.venv/bin/uvicorn: no such file or directory".
WORKDIR /app

# Dependencies resolve from the lockfile in their own layer, before any source is
# copied, so editing a Python file does not re-resolve the dependency tree.
# --no-dev keeps pytest, ruff and mypy out of the runtime image.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---------------------------------------------------------------- runtime
FROM python:3.12-slim-bookworm AS runtime

# Non-root. The service reads no local files and writes none, so it has no reason
# to hold write access to its own image.
RUN groupadd --gid 10001 agro \
 && useradd --uid 10001 --gid agro --no-create-home --shell /usr/sbin/nologin agro

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Same base image as the uv builder tag, so the interpreter the venv symlinks to
# exists at the same path here.
COPY --from=builder --chown=root:root /app/.venv /app/.venv
COPY --from=builder --chown=root:root /app/src /app/src

USER agro

# 8080 matches AGRO_INGEST_URL in agrosensor/include/config.h, so a device
# flashed against a local instance needs no firmware change.
EXPOSE 8080

# Liveness only — it touches nothing external, so a Supabase blip cannot restart
# the container. Readiness is /v1/health/ready and is Kubernetes' business; see
# deploy/k8s/agroapi.yaml.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/v1/health',timeout=2).status==200 else 1)"

# No --reload, no --workers. Concurrency is a pod count, decided by the HPA:
# in-process workers and horizontal replicas both multiply the asyncpg pool
# against Postgres' connection limit, and doing both makes that arithmetic
# invisible.
CMD ["uvicorn", "agroapi.main:app", "--host", "0.0.0.0", "--port", "8080"]
