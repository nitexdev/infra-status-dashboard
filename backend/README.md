# 🚀 Cloud-Native Infrastructure Status Dashboard

A lightweight, real-time infrastructure status monitoring dashboard built with **Node.js**, **Express**, **Alpine.js**, and **Tailwind CSS**. Fully containerized with **Docker** and ready for microservice deployments.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-supported-blue)
![Node.js](https://img.shields.io/badge/backend-Node.js-green)

---

## ✨ Features

- **Live Node Monitoring:** Dynamic real-time server telemetry tracking CPU, Memory, Latency, and Uptime.
- **Microservices Architecture:** Decoupled RESTful API backend and reactive single-page frontend.
- **Automated Status Alerts:** Instant global health state calculation (`Operational` vs. `Degraded`).
- **Lightweight & Containerized:** Minimal memory footprint, ready to deploy via Docker Compose.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, CORS
- **Frontend:** HTML5, Tailwind CSS, Alpine.js
- **DevOps:** Docker, Docker Compose, Nginx

---

## 🚀 Quick Start (Docker)

To run the entire application using Docker Compose:

```bash
git clone [https://github.com/YOUR_USERNAME/infra-status-dashboard.git](https://github.com/YOUR_USERNAME/infra-status-dashboard.git)
cd infra-status-dashboard
docker compose up -d