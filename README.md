# Clinic Appointment Booking System

Role-based appointment booking (patient / admin) with JWT auth, PostgreSQL, Docker and CI.

## Features
- Register / login with bcrypt-hashed passwords and JWT
- Role-based access: admins manage doctors and see all appointments; patients manage their own
- Double-booking prevented at the database level (partial unique index on doctor + slot)
- `/health` endpoint, input validation, unit tests (Jest), GitHub Actions CI

## Tech
Node.js, Express, PostgreSQL, vanilla JS frontend, Docker, GitHub Actions

## Run locally
    docker compose up --build
Open http://localhost:3000. Register with `admin@example.com` to get the admin role.

## Environment variables
See `.env.example`.

## API
| Method | Path | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/doctors | logged in |
| POST/DELETE | /api/doctors | admin |
| POST/GET | /api/appointments | logged in |
| DELETE | /api/appointments/:id | owner or admin |

## Design decisions
- Double-booking is enforced by a DB constraint, so it is safe under concurrent requests.
- Cancellation is a soft delete (status = cancelled) to keep history.
