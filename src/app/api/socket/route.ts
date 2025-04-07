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
    const body = await req.json();
    const { socket_id, channel_name } = body;

    console.log('Auth request:', { socket_id, channel_name });

    if (!socket_id || !channel_name) {
      console.error('Missing socket_id or channel_name');
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    // Validate the channel name
    if (!channel_name.startsWith('private-')) {
      console.error('Invalid channel name:', channel_name);
      return NextResponse.json(
        { error: 'Invalid channel name' },
        { status: 400 }
      );
    }

    // Get the user ID from the request
    const user_id = req.headers.get('x-user-id') || 'anonymous';
    console.log('Auth user:', user_id);

    try {
      // Generate the auth response
      const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
        user_id,
        user_info: {
          name: user_id
        }
      });

      console.log('Auth response generated');
      return NextResponse.json(authResponse);
    } catch (authError) {
      console.error('Error authorizing channel:', authError);
      return NextResponse.json(
        { error: 'Failed to authorize channel' },
        { status: 500 }
      );
    }
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