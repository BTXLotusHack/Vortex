# 🚀 AI-Powered Technical & Behavioral Interview Simulator

An end-to-end, serverless platform designed to simulate hyper-realistic job interview environments. By synthesizing dynamic web scraping, advanced vision-based document parsing, and ultra-low-latency voice AI, this application evaluates candidates and provides actionable, data-driven feedback.

## 🌟 Core Features

* **Hyper-Contextual Scenarios:** Dynamic job scraping (Manus AI) to tailor interview questions to specific roles.
* **Flawless Document Ingestion:** Vision-based OCR (JigsawStack) for perfect CV parsing regardless of formatting.
* **Real-Time Voice Analytics:** Low-latency conversational agents (ElevenLabs) to evaluate technical answers and behavioral frameworks (STAR method).
* **Live Coding Evaluation:** Embedded code editor (Monaco) with real-time AI logic and efficiency analysis.

## 🏗️ Architecture & Tech Stack

This project uses a decoupled, serverless architecture optimized for high scalability and zero-idle compute costs.

* **Frontend:** React (Next.js/Vite), Tailwind CSS. (Hosted on AWS S3 + CloudFront).
* **Backend:** Node.js, Express.js. (Containerized and deployed via AWS Lambda).
* **Database:** Serverless PostgreSQL with `pgvector` for RAG capabilities (Neon.tech / Supabase).
* **AI & APIs:** OpenAI (GPT-4o), ElevenLabs (Voice), JigsawStack (OCR), Manus AI (Web Agents).
* **DevOps:** GitHub Actions for CI/CD, AWS API Gateway for routing and rate-limiting.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Ensure you have the following installed on your local machine:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (For local database testing)
* [Git](https://git-scm.com/)

### 2. Repository Structure
This repository is structured as a monorepo for easier team collaboration:
```text
.
├── /frontend       # React client application
├── /backend        # Node.js Express serverless API
├── /infrastructure # AWS CDK or Terraform scripts (Dev 1)
└── README.md