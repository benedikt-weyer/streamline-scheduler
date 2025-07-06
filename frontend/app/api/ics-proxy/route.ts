import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    // Fetch the ICS calendar
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, application/ics, text/plain',
        'User-Agent': 'Calendar-App/1.0'
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch calendar: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const icsData = await response.text();
    
    // Basic validation to ensure it's actually ICS data
    if (!icsData.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json(
        { error: 'Invalid ICS file format' },
        { status: 400 }
      );
    }
    
    // Return the ICS data as plain text
    return new NextResponse(icsData, {
      headers: {
        'Content-Type': 'text/calendar',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Error proxying ICS request:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - calendar URL took too long to respond' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error while fetching calendar' },
      { status: 500 }
    );
  }
} 