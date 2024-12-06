# ShareBoard - Collaborative Whiteboard & Code Editor

A real-time collaborative workspace that combines whiteboard functionality with code editing capabilities.

## Features

- Shared whiteboard (draw lines, shapes, arrows, text)
- Collaborative code editing with syntax highlighting
- Real-time diagram rendering (Mermaid, PlantUML, Nomnoml)
- Dynamic permissions management
- Optional voting feature
- Client-side state saving
- Access via short URLs

## Tech Stack

- Frontend: React, Tailwind CSS, Fabric.js
- Backend: Node.js, Express, Socket.IO
- Code Editor: Monaco Editor/CodeMirror
- Diagram Rendering: Mermaid.js

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Start the backend server:
```bash
npm run server
```

## Project Structure

- `/client` - React frontend application
- `/server` - Node.js/Express backend
- `/shared` - Shared types and utilities
