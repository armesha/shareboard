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
- React + Vite + TailwindCSS
- Fabric.js - kreslící plocha
- Monaco Editor - editor kódu
- Socket.IO Client - real-time komunikace
- Mermaid - diagramy

### Backend
- Node.js + Express
- Socket.IO - WebSocket server
