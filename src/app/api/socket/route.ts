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

    // Generate auth response for the channel
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
      user_id: socket_id, // Use socket_id as user_id for uniqueness
      user_info: {
        name: 'User'
      }
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Error authorizing channel:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const socket_id = searchParams.get('socket_id');
    const channel_name = searchParams.get('channel_name');

    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    // Generate auth response for the channel
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
      user_id: socket_id, // Use socket_id as user_id for uniqueness
      user_info: {
        name: 'User'
      }
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Error authorizing channel:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';