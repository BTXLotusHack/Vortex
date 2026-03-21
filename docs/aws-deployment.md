# AWS Deployment Guide

This repository is best deployed to AWS as two separate workloads:

- Frontend: Vite static build deployed to S3 behind CloudFront
- Backend: Express API container deployed to AWS App Runner

That split matches the current codebase:

- The frontend builds to static files with `npm run build`
- The backend is a long-running Node server in `server/src/index.ts`

## Recommended architecture

Frontend:

- S3 bucket for static assets
- CloudFront distribution in front of the bucket
- Route 53 DNS record for your domain

Backend:

- ECR repository for container images
- App Runner service running the API container
- Secrets Manager or SSM Parameter Store for server secrets
- CloudWatch Logs for API logs

External services already used by the app:

- Supabase/Postgres
- OpenAI
- ElevenLabs
- SMTP provider

## CI/CD flow in this repo

The workflow at `.github/workflows/aws.yml` does four things:

1. Runs frontend lint, test, and build
2. Runs backend install and TypeScript build
3. On pushes to `main`, deploys the frontend build to S3 and invalidates CloudFront
4. On pushes to `main`, builds the backend Docker image, pushes it to ECR, and starts an App Runner deployment

## GitHub configuration

Create these GitHub repository variables:

- `AWS_REGION`
- `FRONTEND_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `ECR_REPOSITORY`
- `APP_RUNNER_SERVICE_ARN`
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_ELEVENLABS_AGENT_ID`

Create these GitHub repository secrets:

- `AWS_ROLE_ARN`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use GitHub OIDC with AWS so the workflow does not need long-lived AWS access keys.

## AWS setup checklist

### 1. Frontend

- Create an S3 bucket for the Vite `dist/` output
- Create a CloudFront distribution pointing to that bucket
- Set your SPA rewrite rule so unknown paths return `index.html`
- Point your frontend domain to CloudFront

### 2. Backend

- Create an ECR repository named to match `ECR_REPOSITORY`
- Create an App Runner service from that ECR repository
- Configure it to use the `latest` tag and manual deployments
- Set the application port to `3000`
- Attach a custom domain if you want an API subdomain
- Save the service ARN into the GitHub repo variable `APP_RUNNER_SERVICE_ARN`
- Follow the template notes in `.aws/apprunner-setup.md`

### 3. Secrets

Do not store backend secrets in GitHub if App Runner can read them directly from AWS Secrets Manager or SSM.

Move these values out of local `.env` files and into AWS-managed secrets:

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `SESSION_SECRET`
- `JWT_SECRET`
- `DATABASE_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Expose only non-secret frontend values as Vite build variables.

## Important security cleanup

Your local env files currently contain live-looking credentials. Before connecting this repo to CI/CD:

1. Rotate every exposed key and password
2. Remove secrets from tracked files
3. Keep `server/.env` and root `.env` out of git
4. Recreate those secrets in AWS Secrets Manager or GitHub Secrets as appropriate

## Release flow

- Open a pull request: CI validates frontend and backend
- Merge to `main`: GitHub Actions deploys frontend and backend
- App Runner pulls the newest backend image after `start-deployment`
- CloudFront serves the new frontend build

## Why App Runner

Your backend currently starts with `app.listen(...)` and behaves like a traditional Express server. That makes App Runner a low-friction deployment target while staying simpler than ECS Fargate.
