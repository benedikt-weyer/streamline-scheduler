import { NextResponse } from 'next/server';

/**
 * Serves runtime configuration to the client.
 * Environment variables prefixed with PUBLIC_ are exposed here.
 * Use PUBLIC_ instead of NEXT_PUBLIC_ so they are NOT baked in at build time
 * and can be configured per-deployment via container env vars.
 */
export async function GET() {
  return NextResponse.json({
    backendHttpUrl: process.env.PUBLIC_BACKEND_HTTP_URL ?? 'http://localhost:3001',
    backendWsUrl: process.env.PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:3001',
  });
}
