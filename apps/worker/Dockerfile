FROM python:3.13-slim

WORKDIR /app

# System deps for asyncpg and bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/ packages/
COPY apps/__init__.py apps/__init__.py
COPY apps/api/ apps/api/
COPY apps/worker/ apps/worker/

EXPOSE 9000

CMD ["python", "-m", "apps.worker.main"]
