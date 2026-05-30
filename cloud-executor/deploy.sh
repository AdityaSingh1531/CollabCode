#!/bin/bash
# =============================================================================
# CollabCode Cloud Run Executor — One-Time Deployment Script
# =============================================================================
# GCP Project: collabcode-497018
# Region:      us-central1
# Resources:   128Mi RAM, 0.5 vCPU, 3s timeout
#
# Run this script once from the project root:
#   chmod +x cloud-executor/deploy.sh
#   ./cloud-executor/deploy.sh
# =============================================================================

set -e  # Exit immediately on any error

PROJECT_ID="collabcode-497018"
REGION="us-central1"
REPO_NAME="collabcode-repo"
SERVICE_NAME="collabcode-executor"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

echo "=================================================="
echo " CollabCode Cloud Run Executor Deployment"
echo "=================================================="
echo " Project:  $PROJECT_ID"
echo " Region:   $REGION"
echo " Image:    $IMAGE_URI"
echo "=================================================="

# --- Step 1: Enable required GCP APIs ---
echo ""
echo "→ [1/5] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

# --- Step 2: Create Artifact Registry repo (idempotent — skips if exists) ---
echo ""
echo "→ [2/5] Creating Artifact Registry repository (if not exists)..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="CollabCode executor images" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "   Repository already exists, skipping."

# --- Step 3: Configure Docker auth for Artifact Registry ---
echo ""
echo "→ [3/5] Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# --- Step 4: Build and push image using Cloud Build ---
# Uses the Dockerfile inside cloud-executor/ directory.
# Cloud Build streams build logs to your terminal.
echo ""
echo "→ [4/5] Building Docker image via Cloud Build and pushing to Artifact Registry..."
echo "   (This may take 2-4 minutes on first build)"
gcloud builds submit ./cloud-executor \
  --tag="$IMAGE_URI" \
  --project="$PROJECT_ID"

echo ""
echo "   ✅ Image successfully pushed: $IMAGE_URI"

# --- Step 5: Deploy to Cloud Run with strict resource constraints ---
echo ""
echo "→ [5/5] Deploying to Cloud Run with sandbox constraints..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
  --platform=managed \
  --region="$REGION" \
  --memory=128Mi \
  --cpu=0.5 \
  --timeout=10 \
  --concurrency=5 \
  --max-instances=10 \
  --min-instances=0 \
  --allow-unauthenticated \
  --set-env-vars="EXECUTION_TIMEOUT=3" \
  --project="$PROJECT_ID" \
  --quiet

# --- Done: Print the deployed service URL ---
echo ""
echo "=================================================="
echo " ✅ Deployment Complete!"
echo "=================================================="
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo " Service URL: $SERVICE_URL"
echo ""
echo " Next step → paste this URL into your .env file:"
echo "   CLOUD_RUN_URL=$SERVICE_URL"
echo ""
echo " Test the endpoint:"
echo "   curl -X POST $SERVICE_URL/run \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"code\": \"print(42)\", \"language\": \"python\"}'"
echo "=================================================="
