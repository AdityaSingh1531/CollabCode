#!/bin/bash
# =============================================================================
# CollabCode Frontend (Next.js) — Cloud Run Deployment Script
# =============================================================================
# GCP Project: collabcode-497018
# Region:      us-central1
#
# Run from the project root:
#   chmod +x deploy-frontend.sh
#   ./deploy-frontend.sh
#
# Requires: CLOUD_RUN_URL, MISTRAL_API_KEY set in .env or as env vars
# =============================================================================

set -e

PROJECT_ID="collabcode-497018"
REGION="us-central1"
REPO_NAME="collabcode-repo"
SERVICE_NAME="collabcode-frontend"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

# --- Read secrets from .env if present ---
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

echo "=================================================="
echo " CollabCode Frontend Deployment"
echo "=================================================="
echo " Project:  $PROJECT_ID"
echo " Region:   $REGION"
echo " Image:    $IMAGE_URI"
echo "=================================================="

# --- Step 1: Enable required GCP APIs ---
echo ""
echo "→ [1/4] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

# --- Step 2: Ensure Artifact Registry repo exists ---
echo ""
echo "→ [2/4] Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="CollabCode container images" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "   Repository already exists, skipping."

# --- Step 3: Build frontend image via Cloud Build ---
echo ""
echo "→ [3/4] Building frontend Docker image via Cloud Build..."
echo "   (This may take 3-5 minutes on first build)"
gcloud builds submit . \
  --tag="$IMAGE_URI" \
  --project="$PROJECT_ID" \
  --config=/dev/stdin <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.frontend', '-t', '$IMAGE_URI', '.']
images: ['$IMAGE_URI']
EOF

echo ""
echo "   ✅ Frontend image pushed: $IMAGE_URI"

# --- Step 4: Deploy to Cloud Run with env vars ---
echo ""
echo "→ [4/4] Deploying frontend to Cloud Run..."

# Build env-vars string
ENV_VARS="NODE_ENV=production"
if [ -n "$CLOUD_RUN_URL" ]; then
  ENV_VARS="${ENV_VARS},CLOUD_RUN_URL=${CLOUD_RUN_URL}"
fi
if [ -n "$MISTRAL_API_KEY" ]; then
  ENV_VARS="${ENV_VARS},MISTRAL_API_KEY=${MISTRAL_API_KEY}"
fi
if [ -n "$JDOODLE_CLIENT_ID" ]; then
  ENV_VARS="${ENV_VARS},JDOODLE_CLIENT_ID=${JDOODLE_CLIENT_ID}"
fi
if [ -n "$JDOODLE_CLIENT_SECRET" ]; then
  ENV_VARS="${ENV_VARS},JDOODLE_CLIENT_SECRET=${JDOODLE_CLIENT_SECRET}"
fi

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --platform=managed \
  --region="$REGION" \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=0 \
  --port=3000 \
  --allow-unauthenticated \
  --set-env-vars="$ENV_VARS" \
  --project="$PROJECT_ID" \
  --quiet

# --- Done ---
echo ""
echo "=================================================="
echo " ✅ Frontend Deployment Complete!"
echo "=================================================="
FRONTEND_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo " Frontend URL: $FRONTEND_URL"
echo ""
echo " Open in browser: $FRONTEND_URL"
echo "=================================================="
