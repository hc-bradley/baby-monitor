# Baby Monitor Web App

A web-based baby monitor application that uses your devices' cameras to create a simple monitoring system. One device acts as the camera while another device can be used to view the video feed.

## Features

- Real-time video streaming
- Camera and monitor modes
- Connection status indicator
- Last frame update timestamp
- Responsive design
- Works on any device with a camera and web browser

## Prerequisites

- Node.js 18.0.0 or later
- A modern web browser
- Two devices (one for the camera, one for monitoring)
- Internet connection on both devices

## Setup

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd baby-monitor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add:
   ```
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

## Usage

1. On the device you want to use as the camera:
   - Open the app and click "Camera Mode"
   - Allow camera access when prompted
   - Click "Start Camera" to begin streaming

2. On the device you want to use as the monitor:
   - Open the app and click "Monitor Mode"
   - Wait for the connection to establish
   - You should see the video feed from the camera device

## Security Considerations

This is a basic implementation and should not be used in production without additional security measures:

- Implement proper authentication
- Use secure WebSocket connections (WSS)
- Add end-to-end encryption for the video stream
- Restrict CORS settings
- Implement rate limiting

## License

ISC