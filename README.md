# Aymen Immobilier Backend

Backend Node.js API using Express and MySQL.

## Prerequisites

- Node.js installed
- MySQL Server installed and running
- A database created (e.g., `aymen_immobilier`)

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Configure Environment Variables:
    - Open `.env` file.
    - Update `DB_USER`, `DB_PASSWORD`, `DB_NAME` with your MySQL credentials.

3.  Run the server (Development mode):
    ```bash
    npm run dev
    ```

The server will start on port 5000 (default) and automatically sync with the database (create tables if they don't exist).

## API Endpoints

### Candidates

-   **POST** `/api/candidates` - Create a new candidate application.
-   **GET** `/api/candidates` - Retrieve all candidates.
