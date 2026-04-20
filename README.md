# ShareBoard

> Sdílená tabule a editor kódu v reálném čase

## Spuštění projektu

### Předpoklady
- Node.js >= 20.19.0
- npm

### Standardní způsob
```bash
npm install
npm run dev:all
```

- Frontend: http://localhost:5173
- Backend: port 3000
- prod: https://shareboard.live/

#### Konfigurace backend URL (frontend)
Pokud frontend běží na jiném originu než backend, zkopíruj `client/.env.local.example` jako `client/.env.local` (nebo `.env.production.example` jako `.env.production`) a nastav:
`VITE_API_URL=http://localhost:3000` (lokálně) nebo URL tvého backendu (produkce).

## Funkce
- Interaktivní kreslící plocha (tvary, čáry, text, volné kreslení)
- Editor kódu se zvýrazněním syntaxe
- Mermaid diagramy s náhledem
- Real-time synchronizace mezi uživateli
- Podpora 30+ současných uživatelů
- Jazyky: CZ / EN

## Technologie

### Frontend
- React 19 + Vite 7 + TailwindCSS 4 + TypeScript 5
- Fabric.js 7 - kreslící plocha
- Monaco Editor (`@monaco-editor/react` 4) - editor kódu
- Socket.IO Client 4 - real-time komunikace (whiteboard)
- Yjs 13 + y-monaco - kolaborativní editace kódu (CRDT)
- Mermaid 11 - diagramy
- react-i18next - lokalizace CZ/EN
- DOMPurify - sanitizace SVG diagramů

### Backend
- Node.js 20 + Express 5
- Socket.IO 4 - WebSocket server (whiteboard, permissions)
- y-websocket 3 + ws 8 - Yjs WebSocket server (code/diagram sync)
- Helmet - bezpečnostní HTTP hlavičky a CSP
- express-rate-limit - omezovač frekvence

## npm skripty

### Vývoj
- `npm run dev:all` - frontend (5173) + backend (3000) zároveň
- `npm run dev` - pouze frontend (Vite + HMR)
- `npm run server` - pouze backend (tsx)

### Sestavení a kvalita
- `npm run build` - produkční build do `dist/`
- `npm run lint` - ESLint kontrola

### Testy
- `npm test` - jednotkové testy (Vitest)
- `npm run test:watch` - testy ve watch režimu
- `npm run test:coverage` - testy s pokrytím (v8)

### Zátěžové testy
- `npm run load-test:10` / `:30` / `:50` / `:70` / `:100` - simulace N souběžných uživatelů
- `npm run load-test:ramp` - postupné navyšování zátěže
- `npm run load-test:burst` - nárazové připojení
