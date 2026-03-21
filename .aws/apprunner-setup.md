# App Runner Setup Notes

Create the App Runner service once in the AWS console using these settings:

- Source type: `Container registry`
- Provider: `Amazon ECR`
- Repository: your `ECR_REPOSITORY`
- Image tag: `latest`
- Deployment trigger: `Manual`
- Port: `3000`

Set runtime environment variables in App Runner for non-secret values:

- `PORT=3000`
- `CLIENT_URL=https://your-frontend-domain`
- `DB_SSL=true`

Set runtime secrets from AWS Secrets Manager or SSM Parameter Store for secret values:

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

After the service is created, copy its ARN into the GitHub repository variable:

- `APP_RUNNER_SERVICE_ARN`

This repo's workflow pushes a new `latest` image to ECR and then runs `aws apprunner start-deployment`.
