import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Alert from '@/models/Alert';

// This is a polling endpoint for MVP simplicity, or real SSE
// For true SSE in Next.js App Router, we return a ReadableStream
export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream({
        async start(controller) {
            await dbConnect();

            // Send initial connection message
            controller.enqueue(encoder.encode(`data: {"connected": true}\n\n`));

            // Polling loop to check for new alerts (Simulated SSE source)
            // In prod, use Redis PubSub or Change Streams
            let lastCheck = new Date();

            while (!cancelled) {
                try {
                    const newAlerts = await Alert.find({ createdAt: { $gt: lastCheck } });

                    if (newAlerts.length > 0) {
                        lastCheck = new Date();
                        for (const alert of newAlerts) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(alert)}\n\n`));
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
                } catch (e) {
                    console.error("Stream error", e);
                    break;
                }
            }
            controller.close();
        },
        cancel() {
            cancelled = true;
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
