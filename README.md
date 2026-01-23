# MangoShare 🥭

Secure, Peer-to-Peer file sharing application built with Next.js (Web) and Expo (Mobile).

## 🚀 Features

- **P2P Direct Transfer**: Files are transferred directly between devices using Socket.io.
- **Zero Cloud Storage**: No files are stored on any server.
- **Cross-Platform**: Works on Web, Android, and iOS.
- **Secure Rooms**: 6-digit room codes for quick connections.
- **Real-time Progress**: Visual feedback during transmission.
- **Responsive Design**: Cyberpunk-inspired UI with Dark/Light mode support.

## 🛠 Tech Stack

- **Frontend**: Next.js, Tailwind CSS, Lucide Icons
- **Mobile**: Expo, React Native, Lucide Native
- **Backend**: Socket.io (Signaling server)

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd file-share
   ```

2. Install dependencies:

   ```bash
   # For Web
   npm install

   # For Mobile
   cd mobile
   npm install
   ```

### Running the Application

#### Web App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

#### Mobile App

```bash
cd mobile
npm run start
```

Scan the QR code with **Expo Go**.

## 🔌 Socket Server

The app relies on a signaling server. By default, web sockets.
You can change this in the `.env` files.

## 🤝 Security Note

MangoShare is designed for direct device-to-device transfer. Files stay in your local memory and are never written to a middle-man disk during transit.
