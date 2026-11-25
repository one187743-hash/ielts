# Meridian Assessment — International English Testing & Preparation Platform

Independent international English language testing and mock examination platform covering **IELTS Academic & General Training**, **PTE Academic**, **TOEFL iBT**, and **General English CEFR** proficiency.

## Interfaces
1. **Public Website (`/`, `/ielts`, `/pte`, `/toefl`, `/general-english`, `/mock-tests`, `/resources`, `/pricing`, `/about`, `/contact`, `/verify`, `/privacy`, `/terms`)**
2. **Student Portal (`/portal`, `/portal/exams`, `/portal/attempt/:id`, `/portal/reports`, `/portal/reports/:id`, `/portal/profile`)**
3. **Administrator Portal (`/admin`)**

## Quick Start
```bash
npm install
npm run test
npm run dev
```
The Express + Vite server listens on `http://localhost:3000`.

## Demo Credentials (Preview)
- **Comprehensive Plan Student**: `student@meridian-assessment.org` / `Meridian2026!`
- **Free Tier Student**: `starter@meridian-assessment.org` / `Meridian2026!`
- **Administrator**: Open `/admin` to complete the one-time first-run administrator setup, or configure `ADMIN_PASSCODE` in server environment variables.
