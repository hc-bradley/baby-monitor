import 'pusher-js';

declare module 'pusher-js' {
  interface Channel {
    subscribe(channelName: string, options?: { auth?: { params: Record<string, string> } }): Channel;
  }
}