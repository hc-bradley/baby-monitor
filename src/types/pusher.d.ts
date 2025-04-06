import 'pusher-js';

declare module 'pusher-js' {
  interface Options {
    disableStats?: boolean;
    activityTimeout?: number;
    pongTimeout?: number;
  }

  interface Channel {
    subscribe(channelName: string, options?: { auth?: { params: Record<string, string> } }): Channel;
  }
}