npm run dev:all

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



---
Vlastnosti
webová aplikace
realtime aktualizace obsahu u klientů (websocket)
vytvoření nového prostoru skrze zadání klíče (hesla - parametr aplikace), nikoliv autentizace uživatelů nebo víceuživatelský režim apod.
základní plochy
whiteboard
bílá tabule - pero, tvary, text, šipky
codeboard
syntax highligher?
diagram renderer (do whiteboardu?) - mermaid, plantuml, nomnoml, ...
možnost uložení obsahu ploch do souboru ke klientovi ??
"krátká" url s klíčem k prostoru (ne predikovatelné ID/čítač) - připojit se může kdokoliv s url
sdílení prostoru
read only, read write (all), read write (vybrané osoby) - dynamicky měnitelné
Volitelné vlastnosti
Rychlé hlasování - uživatel vyvolá hlasovací otázku s možností zadání 2-4 textových odpovědí
Záznam historie????





---
Online shared whiteboard and codeboard
Zásady pro vypracování*	
Cílem bakalářské práce je vytvoření webové aplikace, která bude sloužit jako sdílený whiteboard a codeboard pro podporu skupinového řešení vybraného programovacího problému.

V teoretické části bude provedena rešerše podobných dostupných nástrojů, které poskytují funkcionalitu whiteboard či codeboard v podobě webové aplikace, kterou může najednou obsluhovat větší množství uživatelů. Na základě rešerše bude navrženo vlastní řešení. Minimální sada vlastností by měla zahrnovat podporu současného připojení minimálně 30 uživatelů, simultánní aktualizace zobrazení u všech uživatelů, základní kreslící nástroje tabule, jednoduchý textový editor pro vkládání kódu a diagramů vykreslených z kódu.

Praktická část bude realizovat vlastní webovou aplikaci, implementovanou s vybraným technologickým stackem. Aplikace by měla být realizována bez trvalé persistence dat a tedy bez nutnosti napojení na databázový systém.

Literatura*	
SIMPSON, Jonathon. How JavaScript Works: Master the Basics of JavaScript and Modern Web App Development. Apress, 2023. ISBN 978-1-4842-9738-4.

HIGGINBOTHAM, James. Principles of Web API Design: Delivering Value with APIs and Microservices. Addison-Wesley Professional, 2021. ISBN 9780137355730.