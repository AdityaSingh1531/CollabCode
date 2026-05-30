#!/bin/bash
# =============================================================================
# CollabCode — Full Stack Deploy (Executor + Frontend)
# =============================================================================
# Deploys both Cloud Run services in sequence:
#   1. Executor (Flask API for JDoodle code execution)
#   2. Frontend (Next.js SSR app) — auto-injects executor URL
#
# Usage from project root:
#   chmod +x deploy-all.sh
#   ./deploy-all.sh
# =============================================================================

set -e

PROJECT_ID="collabcode-497018"
REGION="us-central1"
REPO_NAME="collabcode-repo"

# --- Read secrets from .env ---
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   CollabCode — Full Stack GCP Deployment        ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║   Project:  $PROJECT_ID                  ║"
echo "║   Region:   $REGION                      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: Deploy the Executor
# ═══════════════════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1/2: Deploying Code Executor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Enable APIs (once for both services)
echo ""
echo "→ Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

# Create Artifact Registry repo
echo "→ Ensuring Artifact Registry repository..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="CollabCode container images" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "   Already exists."

# Configure Docker auth
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Build & push executor image
EXECUTOR_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/collabcode-executor:latest"
echo ""
echo "→ Building executor image..."
gcloud builds submit ./cloud-executor \
  --tag="$EXECUTOR_IMAGE" \
  --project="$PROJECT_ID"

# Deploy executor
EXECUTOR_ENV="EXECUTION_TIMEOUT=3"
[ -n "$JDOODLE_CLIENT_ID" ] && EXECUTOR_ENV="${EXECUTOR_ENV},JDOODLE_CLIENT_ID=${JDOODLE_CLIENT_ID}"
[ -n "$JDOODLE_CLIENT_SECRET" ] && EXECUTOR_ENV="${EXECUTOR_ENV},JDOODLE_CLIENT_SECRET=${JDOODLE_CLIENT_SECRET}"

echo ""
echo "→ Deploying executor to Cloud Run..."
gcloud run deploy "collabcode-executor" \
  --image="$EXECUTOR_IMAGE" \
  --platform=managed \
  --region="$REGION" \
  --memory=256Mi \
  --cpu=1 \
  --timeout=30 \
  --concurrency=10 \
  --max-instances=10 \
  --min-instances=0 \
  --allow-unauthenticated \
  --set-env-vars="$EXECUTOR_ENV" \
  --project="$PROJECT_ID" \
  --quiet

# Capture executor URL for frontend
EXECUTOR_URL=$(gcloud run services describe "collabcode-executor" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo "   ✅ Executor live at: $EXECUTOR_URL"

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: Deploy the Frontend (injecting executor URL automatically)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2/2: Deploying Next.js Frontend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build & push frontend image
FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/collabcode-frontend:latest"
echo ""
echo "→ Building frontend image..."
gcloud builds submit . \
  --tag="$FRONTEND_IMAGE" \
  --project="$PROJECT_ID" \
  --config=/dev/stdin <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.frontend', '-t', '$FRONTEND_IMAGE', '.']
images: ['$FRONTEND_IMAGE']
EOF

# Deploy frontend with executor URL auto-injected
FRONTEND_ENV="NODE_ENV=production,CLOUD_RUN_URL=${EXECUTOR_URL}"
[ -n "$MISTRAL_API_KEY" ] && FRONTEND_ENV="${FRONTEND_ENV},MISTRAL_API_KEY=${MISTRAL_API_KEY}"
[ -n "$JDOODLE_CLIENT_ID" ] && FRONTEND_ENV="${FRONTEND_ENV},JDOODLE_CLIENT_ID=${JDOODLE_CLIENT_ID}"
[ -n "$JDOODLE_CLIENT_SECRET" ] && FRONTEND_ENV="${FRONTEND_ENV},JDOODLE_CLIENT_SECRET=${JDOODLE_CLIENT_SECRET}"

echo ""
echo "→ Deploying frontend to Cloud Run..."
gcloud run deploy "collabcode-frontend" \
  --image="$FRONTEND_IMAGE" \
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
  --set-env-vars="$FRONTEND_ENV" \
  --project="$PROJECT_ID" \
  --quiet

FRONTEND_URL=$(gcloud run services describe "collabcode-frontend" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

# ═══════════════════════════════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  CollabCode Deployed Successfully!         ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "   Executor URL:  $EXECUTOR_URL"
echo "   Frontend URL:  $FRONTEND_URL"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo " Smoke tests:"
echo "   curl -s $EXECUTOR_URL/health"
echo ""
echo "   curl -s -X POST $FRONTEND_URL/api/execute \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"code\": \"print(42)\", \"language\": \"python\"}'"
echo ""
echo " Open your IDE: $FRONTEND_URL"
echo ""
