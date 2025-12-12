# ShareBoard

> Sdílená tabule a editor kódu v reálném čase

## Spuštění projektu

### Standardní způsob
```bash
npm install
npm run dev:all
```

- Frontend: http://localhost:5173
- Backend: port 3000
- prod: https://shareboard.live/

#### Konfigurace backend URL (frontend)
Pokud frontend běží na jiném originu než backend, nastav `client/.env.local` nebo `client/.env.production`:
`VITE_API_URL=http://localhost:3000` (lokálně) nebo URL tvého backendu (produkce).

### Docker (alternativní)
```bash
# Development s hot reload
docker-compose up

# Production build
docker-compose --profile prod up production --build
```
## Funkce
- Interaktivní kreslící plocha (tvary, čáry, text, volné kreslení)
- Editor kódu se zvýrazněním syntaxe
- Mermaid diagramy s náhledem
- Real-time synchronizace mezi uživateli
- Podpora 30+ současných uživatelů
- Jazyky: CZ / EN

## Technologie

### Frontend
- React + Vite + TailwindCSS + TypeScript
- Fabric.js 6.9.0 - kreslící plocha
- Monaco Editor - editor kódu
- Socket.IO Client - real-time komunikace (whiteboard)
- Yjs + y-monaco - kolaborativní editace kódu (CRDT)
- Mermaid - diagramy

### Backend
- Node.js + Express
- Socket.IO - WebSocket server (whiteboard, permissions)
- y-websocket - Yjs WebSocket server (code/diagram sync)
