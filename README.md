# webRTC-call-frontend
#### https://webrtc-call-frontend.onrender.com/
A React frontend for real-time audio/video calling using WebRTC.

## Features

- User authentication (with context)
- Audio and video call interface
- Mute/unmute microphone and camera
- Call duration and status indicators
- User avatars and call controls
- Remote/local stream management

## Tech Stack

- **React** (with hooks)
- **TypeScript**
- **WebRTC** for real-time media
- **Tailwind CSS** for styling
- **Lucide-react** for icons

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- npm or yarn

### Installation

```bash
git clone https://github.com/your-username/webRTC-call-frontend.git
cd webRTC-call-frontend
npm install
# or
yarn install
```

### Running the App

```bash
npm start
# or
yarn start
```

The app will run at [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
# or
yarn build
```

## Project Structure

```
src/
  components/      # React components (CallInterface, etc.)
  contexts/        # React context (AuthContext)
  services/        # API and WebRTC logic
  App.tsx          # Main app entry
  index.tsx        # ReactDOM entry
```

## Authentication

Authentication state is managed via React Context (`AuthContext`). User and token are stored in `localStorage`.

## Call Interface

- Video and audio calls are supported.
- Local and remote streams are handled via refs.
- Mute/unmute and camera toggle supported.
- Call duration and audio status are displayed.

## License

MIT

---

**Note:** This is only the frontend. You need a compatible backend signaling server for WebRTC to function.
