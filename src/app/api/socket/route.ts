import { NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

export async function POST(req: Request) {
  try {
    const { socket_id, channel_name } = await req.json();

    // Validate the channel name
    if (!channel_name.startsWith('private-')) {
      return NextResponse.json(
        { error: 'Invalid channel name' },
        { status: 400 }
      );
    }

    // Get the user ID from the request
    const user_id = req.headers.get('x-user-id') || 'anonymous';

    // Generate the auth response
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
      user_id,
      user_info: {
        name: user_id
      }
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Error in socket auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export const dynamic = 'force-dynamic';