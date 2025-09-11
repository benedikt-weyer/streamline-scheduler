# Streamline Scheduler Frontend (SvelteKit)

A modern, privacy-focused task management and calendar application built with SvelteKit, featuring end-to-end encryption and real-time synchronization.

## Features

- **End-to-End Encryption**: All data is encrypted client-side before being sent to the server
- **Real-time Updates**: WebSocket integration for instant synchronization across devices
- **Task Management**: Organize tasks with projects, priorities, and due dates
- **Calendar Integration**: Schedule events and manage your time
- **Drag & Drop**: Intuitive reordering of tasks and projects
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend Framework**: SvelteKit 5
- **Styling**: Tailwind CSS 4
- **Encryption**: crypto-js for client-side encryption
- **Drag & Drop**: dnd-kit-svelte
- **Package Manager**: pnpm
- **Build Tool**: Vite
- **Production Adapter**: Node.js

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create environment file:
   ```bash
   cp env.example .env.local
   ```

3. Update the environment variables:
   ```
   VITE_BACKEND_URL=http://localhost:3001
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

The application will be available at `http://localhost:5173`.

### Building for Production

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

## Project Structure

```
src/
├── lib/
│   ├── api/          # API client for backend communication
│   ├── crypto/       # Encryption/decryption utilities
│   └── stores/       # Svelte stores for state management
├── routes/
│   ├── auth/         # Authentication pages
│   ├── dashboard/    # Main application dashboard
│   └── +layout.svelte
└── app.css           # Global styles
```

## Environment Variables

- `VITE_BACKEND_URL`: URL of the Rust backend API (default: http://localhost:3001)

## Security

This application implements client-side end-to-end encryption:

1. **Master Password**: Users provide a master password that never leaves the client
2. **Key Derivation**: PBKDF2 is used to derive encryption keys from the master password
3. **Data Encryption**: All sensitive data is encrypted using AES before transmission
4. **Zero Knowledge**: The server never has access to unencrypted data

## Docker Deployment

The application includes a multi-stage Dockerfile for production deployment:

```bash
docker build -t streamline-frontend .
docker run -p 3000:3000 streamline-frontend
```

## Authentication Flow

1. User signs up/signs in with email and password
2. User provides master password for encryption key derivation
3. Application loads encrypted data from backend
4. Data is decrypted client-side using the derived key
5. Real-time updates are received via WebSocket and processed accordingly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.