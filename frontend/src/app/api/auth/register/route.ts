import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    // Get the client data
    const clientData = await req.json();

    // Check if the client data is not undefined
    if (clientData.email !== undefined || clientData.password !== undefined) {

        // Send the client data to the backend and get the response
        const resBackend = await fetch("http://localhost:8181/api/v1/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: clientData.email,
                password: clientData.password,
            })
        });

        // Get the response from the backend as JSON
        const resBackendJson = await resBackend.json();

        console.log(resBackendJson);

        // Forward the response from the backend to the client
        return NextResponse.json(resBackendJson, {
            status: resBackend.status
        });
    }
}