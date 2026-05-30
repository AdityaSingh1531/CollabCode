# =============================================================================
# CollabCode Cloud Executor — Production Dockerfile
# =============================================================================
# Base: Python 3.11 slim (Debian-based, smaller than Alpine for pip packages)
# Serves via gunicorn (production WSGI) instead of Flask dev server
# =============================================================================

FROM python:3.11-slim

# Install system dependencies for compilation (C/C++ via JDoodle, not local)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a low-privilege sandbox user
RUN useradd -m -s /bin/bash sandboxuser

WORKDIR /app

# Copy and install Python dependencies first (layer cache optimisation)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn==21.2.0

# Copy the application code
COPY main.py .
RUN chown -R sandboxuser:sandboxuser /app

# Switch to low-privilege user
USER sandboxuser

# Cloud Run listens on PORT env var (default 8080)
EXPOSE 8080

# Use gunicorn for production: 2 workers, bind to Cloud Run's $PORT
CMD exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 30 main:app
