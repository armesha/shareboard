# ShareBoard - Complete Technical Documentation

**Version:** 1.0.0
**Last Updated:** 2026-01-14
**Tech Stack:** React 19 + Vite 7 + TailwindCSS 4 + TypeScript (Frontend), Node.js + Express 5 + Socket.IO + Yjs (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Frontend Core](#3-frontend-core)
4. [Frontend Components](#4-frontend-components)
5. [Frontend State Management](#5-frontend-state-management)
6. [Frontend Utilities](#6-frontend-utilities)
7. [Backend Server](#7-backend-server)
8. [Shared Code](#8-shared-code)
9. [Testing](#9-testing)
10. [Configuration](#10-configuration)
11. [DevOps](#11-devops)
12. [Internationalization](#12-internationalization)

---

# 1. Project Overview

## 1.1 What is ShareBoard?

ShareBoard is a real-time collaborative whiteboard and code editor application. It allows multiple users to simultaneously:

- **Draw** on an interactive canvas (shapes, lines, text, freehand drawing)
- **Edit code** with syntax highlighting and language support
- **Create diagrams** using Mermaid syntax with live preview
- **Collaborate** in real-time with cursor synchronization

## 1.2 Key Features

| Feature | Description |
|---------|-------------|
| Interactive Canvas | Fabric.js-powered whiteboard with shapes, lines, arrows, text, and freehand drawing |
| Code Editor | Monaco Editor with multi-language syntax highlighting |
| Diagram Support | Mermaid diagram rendering with live preview |
| Real-time Sync | Socket.IO for whiteboard, Yjs CRDT for code/diagrams |
| Sharing Modes | Read-only, Read-write-all, Read-write-selected (token-based) |
| Multi-language | English and Czech localization |
| 30+ Users | Supports 30+ concurrent users per workspace |

## 1.3 Technology Stack

### Frontend
- **React 19** with concurrent rendering
- **Vite 7** for build tooling
- **TailwindCSS 4** for styling
- **TypeScript** with strict mode
- **Fabric.js 6.9** for canvas manipulation
- **Monaco Editor** for code editing
- **Yjs + y-monaco** for collaborative text editing
- **Socket.IO Client** for real-time communication
- **Mermaid** for diagram rendering
- **i18next** for internationalization

### Backend
- **Node.js 20+** runtime
- **Express 5** web framework
- **Socket.IO** WebSocket server
- **y-websocket** Yjs server
- **Helmet** security headers
- **Zod** runtime validation

## 1.4 File Statistics

| Category | File Count |
|----------|------------|
| Frontend Components | 26 |
| Frontend Context/State | 6 |
| Frontend Hooks | 20 |
| Frontend Utilities | 12 |
| Frontend i18n | 17 |
| Backend Handlers | 7 |
| Backend Services | 4 |
| Backend Utilities | 5 |
| Tests | 16 |
| Configuration | 11 |
| **Total** | ~133 |

---

# 2. Architecture

## 2.1 High-Level Architecture

```
+------------------------------------------------------------------+
|                         CLIENT (React)                            |
+------------------------------------------------------------------+
|  Pages          |  Components        |  State Management          |
|  - LandingPage  |  - Whiteboard      |  - SocketContext           |
|  - Workspace    |  - CodeEditor      |  - WhiteboardContext       |
|                 |  - DiagramRenderer |  - CodeEditorContext       |
|                 |  - Toolbar         |  - SharingContext          |
|                 |  - UI Components   |  - YjsContext              |
|                 |                    |  - DiagramEditorContext    |
+------------------------------------------------------------------+
|                    Socket.IO Client    |    Yjs WebSocket          |
+-----------------------------+-------------------+-----------------+
                              |                   |
                              v                   v
+--------------------------------------+ +------------------------+
|         EXPRESS + SOCKET.IO          | |    Y-WEBSOCKET SERVER  |
+--------------------------------------+ +------------------------+
|  Handlers       |  Services          | |  - WSSharedDoc         |
|  - workspace    |  - workspaceService| |  - Sync Protocol       |
|  - whiteboard   |  - permissionSvc   | |  - Awareness           |
|  - editor       |  - batchService    | |  - Persistence         |
|  - sharing      |  - rateLimitSvc    | +------------------------+
|  - textEdit     |                    |
+--------------------------------------+
|  Middleware     |  Validation        |
|  - socketAuth   |  - schemas (Zod)   |
|                 |  - validators      |
+--------------------------------------+
```

## 2.2 Data Flow

### Whiteboard Synchronization
```
User Action -> Fabric.js Event -> Handler Hook -> Socket.IO Emit
    |
Server Handler -> Validation -> Permission Check -> Batch Queue
    |
Batch Interval (50ms) -> Broadcast to Room -> Client Update
```

### Code/Diagram Synchronization (Yjs)
```
User Typing -> Monaco Editor -> Yjs Binding -> Y.Text Update
    |
WebSocket Provider -> y-websocket Server -> Sync Protocol
    |
Broadcast to Clients -> Yjs Apply Update -> Monaco Update
```

## 2.3 Provider Hierarchy

```tsx
<SocketProvider>                    // WebSocket connection (App.tsx)
  <RouterProvider>                  // React Router
    <SharingProvider>               // Permissions & sharing mode (Workspace.tsx)
      <YjsProvider>                 // Yjs document & sync
        <WhiteboardProvider>        // Canvas state & tools
          <CodeEditorProvider>      // Code content & language
            <DiagramEditorProvider> // Diagram content
              <WorkspaceLayout />   // Main UI
            </DiagramEditorProvider>
          </CodeEditorProvider>
        </WhiteboardProvider>
      </YjsProvider>
    </SharingProvider>
  </RouterProvider>
</SocketProvider>
```

## 2.4 Security Layers

| Layer | Implementation |
|-------|----------------|
| **HTTP** | Helmet headers (CSP, Referrer-Policy: strict-origin), CORS, rate limiting |
| **Socket.IO** | Per-socket rate limiting, room auth, write permissions on all drawing events |
| **Yjs** | Per-IP rate limiting, workspace validation |
| **Tokens** | Timing-safe comparison, `edit_` prefix validation, URL cleared after reading |

---

# 3. Frontend Core

## 3.1 Entry Point: main.tsx

**File:** `client/src/main.tsx`

### Imports

```typescript
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';
```

### Functionality

- Imports i18n configuration for internationalization (side-effect)
- Imports the root `App` component
- Imports global styles from `index.css`
- Gets the root DOM element by ID `'root'`
- Throws an error if root element is not found
- Creates React root and renders `<App />` component

### Code

```typescript
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(<App />);
```

## 3.2 App Component: App.tsx

**File:** `client/src/App.tsx`

### Imports

```typescript
import {
  Navigate,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import { SocketProvider } from './context/SocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TOAST } from './constants';
```

### Router Configuration

```typescript
const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <LandingPage />
    },
    {
      path: "/w/:workspaceId",
      element: <Workspace />
    },
    {
      path: "*",
      element: <Navigate to="/" replace />
    }
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
      v7_fetcherPersist: true
    }
  }
);
```

### Routes

| Path | Element | Description |
|------|---------|-------------|
| `/` | `<LandingPage />` | Home/landing page |
| `/w/:workspaceId` | `<Workspace />` | Workspace with dynamic ID |
| `*` | `<Navigate to="/" replace />` | Catch-all redirect to home |

### Provider Hierarchy (App Level)

```
SocketProvider
  +-- div.min-h-screen.bg-gray-100
      +-- RouterProvider
      +-- ToastContainer
```

### JSX Structure

```tsx
function App() {
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-100">
        <RouterProvider router={router} />
        <ToastContainer
          position={TOAST.POSITION}
          newestOnTop={false}
        />
      </div>
    </SocketProvider>
  );
}
```

### CSS Classes Used

- `min-h-screen` - Minimum height of viewport
- `bg-gray-100` - Light gray background

## 3.3 Workspace Page: Workspace.tsx

**File:** `client/src/pages/Workspace.tsx`

### Imports

```typescript
import { useState, useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../context/SocketContext';
import { WhiteboardProvider, useWhiteboard } from '../context/WhiteboardContext';
import { CodeEditorProvider } from '../context/CodeEditorContext';
import { DiagramEditorProvider } from '../context/DiagramEditorContext';
import { YjsProvider } from '../context/YjsContext';
import { SharingProvider, useSharing } from '../context/SharingContext';
import WorkspaceContent from '../components/WorkspaceContent';
import SharingSettings from '../components/SharingSettings';
import { SOCKET_EVENTS, STORAGE_KEYS, LAYOUT, CONNECTION_STATUS } from '../constants';
import { toast } from '../utils/toast';
import { getPersistentUserId } from '../utils';
```

### Type Definitions

```typescript
type ViewMode = 'whiteboard' | 'split';

interface WorkspaceStateData {
  isNewWorkspace?: boolean;
}

interface SessionEndedData {
  message: string;
}

interface WorkspaceGateProps {
  workspaceId: string;
}
```

### Component Structure

The file contains three components:

1. **`Workspace`** (default export) - Top-level wrapper with SharingProvider
2. **`WorkspaceGate`** - Gate component that checks workspace validity
3. **`WorkspaceLayout`** - Main workspace UI and logic

### Component: Workspace (Default Export)

```tsx
export default function Workspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <SharingProvider workspaceId={workspaceId ?? ''}>
      <WorkspaceGate workspaceId={workspaceId ?? ''} />
    </SharingProvider>
  );
}
```

### Component: WorkspaceGate

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `workspaceId` | `string` | The workspace ID from URL params |

#### Hooks Used

- `useTranslation('messages')` - Returns `t` function
- `useNavigate()` - Returns `navigate` function
- `useSharing()` - Returns sharing context

#### Refs

| Ref | Type | Initial Value | Purpose |
|-----|------|---------------|---------|
| `hasNavigatedRef` | `RefObject<boolean>` | `false` | Prevents duplicate navigation on workspace not found |

#### useEffect: Handle workspace not found

```typescript
useEffect(() => {
  if (workspaceNotFound && !hasNavigatedRef.current) {
    hasNavigatedRef.current = true;
    toast.error(t('errors.workspaceNotFound'), {
      position: 'bottom-left',
      autoClose: 3000
    });
    navigate('/', { replace: true });
  }
}, [workspaceNotFound, navigate, t]);
```

#### Provider Hierarchy (WorkspaceGate)

```
YjsProvider (workspaceId)
  +-- WhiteboardProvider
      +-- CodeEditorProvider
          +-- DiagramEditorProvider
              +-- WorkspaceLayout
```

### Component: WorkspaceLayout

#### State Variables

| State Variable | Type | Initial Value | Description |
|----------------|------|---------------|-------------|
| `viewMode` | `ViewMode` | `'whiteboard'` | Current view mode |
| `splitPosition` | `number` | localStorage or `40` | Split panel position percentage |
| `isDragging` | `boolean` | `false` | Whether user is dragging the split handle |
| `initialMouseX` | `number \| null` | `null` | Initial mouse X position when dragging started |
| `initialWidth` | `number \| null` | `null` | Initial width when dragging started |
| `showSharingSettings` | `boolean` | `false` | Whether sharing settings modal is open |
| `persistentUserId` | `string \| null` | `null` | Persistent user ID from utility function |
| `isNewWorkspace` | `boolean` | `false` | Whether this is a newly created workspace |

#### Refs

| Ref | Type | Purpose |
|-----|------|---------|
| `containerRef` | `RefObject<HTMLDivElement>` | Reference to the main container for calculating split positions |

#### useEffect Hooks

| Effect | Dependencies | Purpose |
|--------|--------------|---------|
| Initialize persistent user ID | `[]` | Gets and sets the persistent user ID |
| Handle mouse drag | `[isDragging, initialMouseX, initialWidth]` | Handles drag-to-resize functionality |
| Persist split position | `[isDragging, splitPosition]` | Saves split position to localStorage |
| Socket events | `[socket, workspaceId, persistentUserId, navigate]` | Listens for workspace state and session ended |
| Auto-open sharing | `[isOwner, isNewWorkspace, showSharingSettings]` | Opens sharing modal for new workspace owners |

#### Event Handlers

| Handler | Purpose |
|---------|---------|
| `handleMouseDown` | Initiates split panel drag operation |
| `cycleViewMode` | Toggles between whiteboard and split view modes |
| `toggleSharingSettings` | Toggles sharing settings modal visibility |

#### CSS Classes Used

| Element | Classes |
|---------|---------|
| Root container | `fixed inset-0 flex flex-col bg-gray-100` |
| Loading overlay | `absolute inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80` |
| Spinner (connecting) | `inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4` |
| Spinner (loading) | `inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent mb-4` |
| Modal overlay | `fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm` |

## 3.4 Landing Page: LandingPage.tsx

**File:** `client/src/pages/LandingPage.tsx`

### Imports

```typescript
import { useState, Suspense, lazy, useMemo, useCallback, useRef, useEffect, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/ui';
import { useSocket } from '../context/SocketContext';
import { getPersistentUserId } from '../utils';
import { CURSOR_ANIMALS, CURSOR_COLORS, SOCKET_EVENTS } from '../constants';
import { toast } from '../utils/toast';
```

### Lazy Loaded Components

```typescript
const DemoWhiteboard = lazy(() => import('../components/demo/DemoWhiteboard'));
```

### State Variables

| State Variable | Type | Initial Value | Description |
|----------------|------|---------------|-------------|
| `workspaceKey` | `string` | `''` | Input value for joining workspace |
| `isLoading` | `boolean` | `false` | Whether workspace is being created |
| `isJoining` | `boolean` | `false` | Whether user is joining a workspace |
| `error` | `string \| null` | `null` | Error message to display |

### Refs

| Ref | Type | Purpose |
|-----|------|---------|
| `joinTimeoutRef` | `RefObject<ReturnType<typeof setTimeout> \| null>` | Stores timeout for join operation cleanup |

### Key Functions

#### createWorkspace
```typescript
const createWorkspace = async (): Promise<void> => {
  // POST to /api/workspaces with userId
  // Navigate to /w/{workspaceId} on success
};
```

#### joinWorkspace
```typescript
const joinWorkspace = useCallback((e: FormEvent<HTMLFormElement>): void => {
  // Check workspace exists via socket
  // Navigate on success, show error on failure
}, [socket, workspaceKey, navigate, tMessages]);
```

### Features

- Animated demo whiteboard background
- Floating demo cursors with animal names
- Language switcher
- Create workspace button
- Join workspace form

## 3.5 Global Styles: index.css

**File:** `client/src/index.css`

### Tailwind Import

```css
@import "tailwindcss";
```

### Theme Configuration

```css
@theme {
  --animate-fadeIn: fadeIn 0.2s ease-out;
  --animate-slideUp: slideUp 0.3s ease-out;
  --animate-pulse-slow: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  --color-primary: oklch(0.623 0.214 259.815);
  --color-primary-dark: oklch(0.546 0.245 262.881);
  --color-success: oklch(0.723 0.191 142.542);
  --color-warning: oklch(0.795 0.184 86.047);
  --color-danger: oklch(0.637 0.237 25.331);
}
```

### Keyframe Animations

| Animation | Description |
|-----------|-------------|
| `fadeIn` | Opacity 0 to 1 |
| `slideUp` | Opacity 0 to 1, translateY 10px to 0 |
| `toolbarSlideIn` | Opacity 0 to 1, translateX -10px to 0 |
| `dropdownFadeIn` | Opacity 0 to 1, translateY -4px to 0 |
| `cardEntrance` | Opacity 0 to 1, translateY 30px to 0, scale 0.95 to 1 |
| `floatCursor` | Floating cursor animation with rotation |
| `pulseRing` | Scale 1 to 1.5, opacity 1 to 0 |
| `diagramFadeIn` | Opacity 0.5 to 1 |

### CSS Component Classes

#### Buttons
| Class | Description |
|-------|-------------|
| `.btn` | Base button styles |
| `.btn-primary` | Blue primary button |
| `.btn-secondary` | Gray secondary button |
| `.btn-icon` | Icon-only button |
| `.btn-icon-active` | Active state icon button |

#### Layout
| Class | Description |
|-------|-------------|
| `.card` | Card container |
| `.modal-overlay` | Modal backdrop |
| `.toolbar` | Horizontal toolbar container |
| `.toolbar-panel` | Vertical toolbar panel |

#### Landing Page
| Class | Description |
|-------|-------------|
| `.landing-content` | Landing page content wrapper |
| `.landing-card` | Main landing card |
| `.landing-btn-primary` | Primary CTA button |
| `.landing-input` | Styled input field |

#### Remote Cursors
| Class | Description |
|-------|-------------|
| `.remote-cursors-container` | Remote cursors wrapper |
| `.remote-cursor` | Individual remote cursor |
| `.remote-cursor-label` | Cursor username label |

### Responsive & Accessibility

```css
@media (max-width: 640px) {
  .toolbar { @apply py-1.5 px-1.5 gap-0.5; }
  .btn-icon { @apply p-1.5; }
}

@media (prefers-reduced-motion: reduce) {
  .animate-fadeIn, .animate-slideUp, .modal-overlay, ... {
    animation: none;
  }
}
```

---

# 4. Frontend Components

## 4.1 Main Feature Components

### Whiteboard.tsx
**Path:** `client/src/components/Whiteboard.tsx`

Core Fabric.js canvas component with drawing tools and real-time sync.

**Hooks Used:**
- `useShapeDrawing` - Shape creation
- `useLineDrawing` - Line/arrow drawing
- `useTextEditing` - Text element creation
- `useObjectModification` - Transform handling
- `useCanvasPanning` - Pan/zoom controls
- `useKeyboardDelete` - Delete key handling

**Key Event Handlers:**
| Handler | Purpose |
|---------|---------|
| `handleMouseDown` | Start shape/line/text based on tool |
| `handleMouseMove` | Update shape/line, emit cursor position |
| `handleMouseUp` | Finish drawing |

### CodeEditor.tsx
**Path:** `client/src/components/CodeEditor.tsx`

Monaco-based code editor with Yjs collaborative editing.

**Props:**
```typescript
interface CodeEditorProps {
  onAddToWhiteboard?: () => void;
  onEmptyWarning?: () => void;
  canAddToWhiteboard?: boolean;
}
```

**Features:**
- Language selector dropdown
- Insert example code button
- Add to whiteboard button
- Read-only mode support
- Yjs MonacoBinding for collaboration

### DiagramRenderer.tsx
**Path:** `client/src/components/DiagramRenderer.tsx`

Mermaid diagram editor with live preview and pan/zoom.

**State:**
| State | Type | Purpose |
|-------|------|---------|
| `error` | `string \| null` | Render error |
| `errorLine` | `number \| null` | Error line number |
| `editorHeight` | `number` | Editor panel height % |
| `zoom` | `number` | Preview zoom level |
| `pan` | `{x, y}` | Preview pan offset |

### SharingSettings.tsx
**Path:** `client/src/components/SharingSettings.tsx`

Modal for workspace sharing configuration.

**For Owners:**
- Radio buttons for sharing modes
- View link (blue box with copy)
- Edit link (green box with copy)

**Sharing Modes:**
| Mode | Description |
|------|-------------|
| `READ_ONLY` | Only owner can edit |
| `READ_WRITE_ALL` | Anyone can edit |
| `READ_WRITE_SELECTED` | Token required for edit |

## 4.2 Layout Components

### Header.tsx
**Path:** `client/src/components/layout/Header.tsx`

Workspace header with ID display and navigation.

**Features:**
- Home button with icon
- Workspace ID with click-to-copy
- Read-only badge (conditional)

### Toolbar.tsx
**Path:** `client/src/components/layout/Toolbar.tsx`

Vertical toolbar with drawing tools and options.

**Sections:**
1. Select tool (always visible)
2. Drawing tools (write access): Pen, Shapes, Text
3. Read-only indicator (no write access)
4. Actions: Share, Options menu

## 4.3 UI Components

| Component | Purpose |
|-----------|---------|
| `ColorPicker` | Color selection with palette and custom input |
| `ConfirmDialog` | Modal confirmation with variants |
| `ConnectionStatus` | Connection indicator with participant count |
| `ExportPreviewModal` | Canvas export with area selection |
| `LanguageSwitcher` | EN/CZ toggle button |
| `RemoteCursors` | Renders other users' cursor positions |
| `ShapesMenu` | Shape selection dropdown |
| `ZoomControls` | Zoom percentage and +/- buttons |

---

# 5. Frontend State Management

## 5.1 SocketContext

**File:** `client/src/context/SocketContext.tsx`

Manages the WebSocket connection to the server using Socket.IO.

### TypeScript Interface

```typescript
type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketContextValue {
  socket: Socket | null;
  connectionStatus: ConnectionStatusType;
  connectionError: string | null;
  connectionAttempts: number;
  maxReconnectAttempts: number;
  userId: string | null;
}
```

### State Variables

| Variable | Type | Initial Value | Description |
|----------|------|---------------|-------------|
| `socket` | `Socket \| null` | `null` | Socket.IO client instance |
| `connectionAttempts` | `number` | `0` | Counter for reconnection attempts |
| `connectionError` | `string \| null` | `null` | Error message from connection failures |
| `connectionStatus` | `ConnectionStatusType` | `'connecting'` | Current connection state |
| `userId` | `string \| null` | `null` | Persistent user identifier from storage |

### Refs

| Ref | Type | Description |
|-----|------|-------------|
| `socketInstanceRef` | `MutableRefObject<Socket \| null>` | Stores socket instance for cleanup |

### Socket Configuration

```typescript
const socketInstance = io(serverUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: maxReconnectAttempts,
  reconnectionDelay: TIMING.RECONNECT_DELAY,
  reconnectionDelayMax: TIMING.RECONNECT_MAX_DELAY,
  timeout: TIMING.SOCKET_TIMEOUT,
  transports: ['websocket', 'polling']
});
```

### Socket Event Handlers

| Event | Description |
|-------|-------------|
| `connect` | Resets attempts, clears errors, sets status to 'connected' |
| `connect_error` | Sets status to 'error', stores error message, increments attempts |
| `disconnect` | Sets status to 'disconnected', clears socket |
| `error` | Stores error message, shows error toast |

### Custom Hook

```typescript
export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
```

## 5.2 SharingContext

**File:** `client/src/context/SharingContext.tsx`

Manages workspace sharing permissions, access control, and user roles.

### TypeScript Interface

```typescript
type SharingModeType = 'read-only' | 'read-write-all' | 'read-write-selected';

interface SharingContextValue {
  sharingMode: SharingModeType;
  allowedUsers: string[];
  isOwner: boolean;
  currentUser: string | null;
  hasEditAccess: boolean;
  canWrite: () => boolean;
  changeMode: (newMode: SharingModeType) => void;
  workspaceOwner: string | null;
  sharingInfoReceived: boolean;
  workspaceNotFound: boolean;
  isCheckingWorkspace: boolean;
  accessToken: string | null;
}
```

### State Variables

| Variable | Type | Initial Value | Description |
|----------|------|---------------|-------------|
| `sharingMode` | `SharingModeType` | `'read-write-selected'` | Current sharing mode |
| `allowedUsers` | `string[]` | `[]` | Users with edit permission |
| `isOwner` | `boolean` | `false` | Current user is workspace owner |
| `currentUser` | `string \| null` | `null` | Current user ID |
| `persistentUserId` | `string \| null` | `null` | Persistent user ID from storage |
| `hasEditAccess` | `boolean` | `false` | User has edit access |
| `workspaceOwner` | `string \| null` | `null` | Workspace owner ID |
| `sharingInfoReceived` | `boolean` | `false` | Server sent sharing info |
| `workspaceNotFound` | `boolean` | `false` | Workspace doesn't exist |
| `isCheckingWorkspace` | `boolean` | `true` | Checking workspace existence |
| `accessToken` | `string \| null` | `null` | Access token for workspace |

### Refs

| Ref | Type | Description |
|-----|------|-------------|
| `pendingJoinRef` | `MutableRefObject<boolean>` | Prevents duplicate join requests |

### Key Functions

```typescript
const canWrite = useCallback((): boolean => {
  if (isOwner) return true;
  if (sharingMode === SHARING_MODES.READ_ONLY) return false;
  if (sharingMode === SHARING_MODES.READ_WRITE_ALL) return true;
  return hasEditAccess;
}, [isOwner, sharingMode, hasEditAccess]);

const changeMode = useCallback((newMode: SharingModeType): void => {
  if (!socket || !workspaceId || !isOwner) return;
  socket.emit(SOCKET_EVENTS.CHANGE_SHARING_MODE, { workspaceId, sharingMode: newMode });
}, [socket, workspaceId, isOwner]);
```

### Socket Event Handlers

| Event | Description |
|-------|-------------|
| `SHARING_INFO` | Updates sharing mode, allowed users, edit access, owner info |
| `EDIT_TOKEN_UPDATED` | Stores new edit token in session storage |
| `SHARING_MODE_CHANGED` | Updates mode, allowed users, edit access |

## 5.3 YjsContext

**File:** `client/src/context/YjsContext.tsx`

Manages Yjs document synchronization for real-time collaborative editing.

### TypeScript Interface

```typescript
type YjsStatus = 'disconnected' | 'connecting' | 'connected';

interface YjsContextValue {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  status: YjsStatus;
  synced: boolean;
}
```

### State Variables

| Variable | Type | Initial Value | Description |
|----------|------|---------------|-------------|
| `doc` | `Y.Doc` | `new Y.Doc()` | Yjs document |
| `provider` | `WebsocketProvider \| null` | `null` | WebSocket provider |
| `status` | `YjsStatus` | `'disconnected'` | Connection status |
| `synced` | `boolean` | `false` | Document sync status |

### Connection Status Handling

- Status is included in the overall workspace connection status calculation
- Toast notification is shown when Yjs disconnects (after initial connection)
- Reconnection is handled automatically by y-websocket

### Awareness User Info

```typescript
wsProvider.awareness.setLocalStateField('user', {
  id: currentUser || workspaceId,
  name: animalName,      // Translated animal name
  color,                 // Deterministic color
  animal: animalKey
});
```

## 5.4 CodeEditorContext

**File:** `client/src/context/CodeEditorContext.tsx`

Manages code editor content and language selection with Yjs-based synchronization.

### TypeScript Interface

```typescript
interface CodeEditorContextValue {
  content: string;
  language: string;
  setContent: (value: string) => void;
  setLanguage: (language: string) => void;
}
```

### State Variables

| Variable | Type | Initial Value | Description |
|----------|------|---------------|-------------|
| `language` | `string` | `'javascript'` | Selected programming language |
| `content` | `string` | `''` | Current code content |

### Yjs Integration

- Uses `doc.getText('code')` for shared text
- Observes changes and updates local state
- Initializes with language-specific examples

### Socket Event Handlers

| Event | Description |
|-------|-------------|
| `CODE_UPDATE` | Updates language when another user changes it |
| `WORKSPACE_STATE` | Sets initial language and content from server state |

## 5.5 DiagramEditorContext

**File:** `client/src/context/DiagramEditorContext.tsx`

Manages Mermaid diagram content with Yjs-based synchronization and optimized diff updates.

### TypeScript Interface

```typescript
interface DiagramEditorContextValue {
  content: string;
  setContent: (value: string) => void;
  isReadOnly: boolean;
}
```

### State Variables

| Variable | Type | Initial Value | Description |
|----------|------|---------------|-------------|
| `content` | `string` | `SAMPLE_DIAGRAM` | Current diagram source |
| `isReadOnly` | `boolean` | `false` | Read-only mode based on permissions |

### Socket Event Handlers

| Event | Description |
|-------|-------------|
| `WORKSPACE_STATE` | Sets initial diagram content from server if Yjs document is empty |

### Optimized setContent

```typescript
const setContent = useCallback((value: string): void => {
  if (!yText || isReadOnly) return;

  // Calculate common prefix
  let prefixLen = 0;
  // Calculate common suffix
  let suffixLen = 0;

  // Only modify changed portion
  yText.doc?.transact(() => {
    if (deleteCount > 0) yText.delete(deleteStart, deleteCount);
    if (insertText) yText.insert(deleteStart, insertText);
  });
}, [yText, isReadOnly]);
```

## 5.6 WhiteboardContext

**File:** `client/src/context/WhiteboardContext.tsx`

Central whiteboard state orchestrating multiple specialized hooks.

### TypeScript Interface

```typescript
interface WhiteboardContextValue {
  tool: Tool;
  color: string;
  width: number;
  fontSize: number;
  zoom: number;
  WHITEBOARD_BG_COLOR: string;
  selectedShape: Shape | null;
  activeUsers: number;
  elements: Element[];
  canvasRef: MutableRefObject<Canvas | null>;
  batchedRenderRef: MutableRefObject<(() => void) | null>;
  isUpdatingRef: MutableRefObject<boolean>;
  isConnected: boolean;
  isLoading: boolean;
  connectionStatus: string;
  initCanvas: (canvasElement: HTMLCanvasElement) => () => void;
  clearCanvas: () => void;
  addElement: (element: Element) => void;
  updateElement: (id: string, element: Element, isMoving?: boolean) => void;
  setTool: Dispatch<SetStateAction<Tool>>;
  setSelectedShape: (shape: Shape | null) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setFontSize: (fontSize: number) => void;
  setZoom: (zoom: number) => void;
  setZoomState: Dispatch<SetStateAction<number>>;
  getFullCanvasImage: () => CanvasImageData | null;
}
```

### Composed Hooks

| Hook | Purpose |
|------|---------|
| `useWhiteboardCanvas` | Canvas initialization and refs |
| `useWhiteboardElements` | Element state and CRUD |
| `useWhiteboardSync` | Connection and sync state |
| `useWhiteboardTools` | Tool selection and settings |
| `useRemoteDrawing` | Remote drawing visualization |

### Socket Event Handlers (via Composed Hooks)

These events are handled in the composed hooks (`useWhiteboardSync`, `useRemoteDrawing`), not directly in WhiteboardContext:

| Event | Hook | Description |
|-------|------|-------------|
| `CONNECT` | `useWhiteboardSync` | Sets connected status |
| `DISCONNECT` | `useWhiteboardSync` | Sets disconnected status |
| `WORKSPACE_STATE` | `useWhiteboardSync` | Loads initial whiteboard state |
| `WHITEBOARD_UPDATE` | `useWhiteboardSync` | Applies element updates |
| `WHITEBOARD_CLEAR` | `useWhiteboardSync` | Clears all elements |
| `DELETE_ELEMENT` | `useWhiteboardSync` | Removes specific element |
| `USER_JOINED` / `USER_LEFT` | `useWhiteboardSync` | Updates active user count |
| `DRAWING_START/STREAM/END` | `useRemoteDrawing` | Remote path drawing |
| `SHAPE_DRAWING_START/UPDATE/END` | `useRemoteDrawing` | Remote shape drawing |

## 5.7 Custom Hooks Overview

### Canvas & Drawing Hooks

| Hook | Purpose |
|------|---------|
| `useCanvasPanning` | Space-bar and right-click panning, mouse wheel zoom |
| `useCodeToCanvas` | Add code content as text element |
| `useDiagramToCanvas` | Render diagram as PNG and add to canvas |
| `useDrawingStream` | Stream freehand drawing points to server |
| `useLineDrawing` | Line/arrow drawing with Shift-key snapping |
| `useObjectModification` | Handle object transforms with debouncing |
| `useShapeDrawing` | Shape drawing with Ctrl-key constraints |
| `useTextEditing` | Create editable text elements |

### Real-time Sync Hooks

| Hook | Purpose |
|------|---------|
| `useCursorSync` | Cursor position synchronization |
| `useRemoteDrawing` | Orchestrates remote drawing visualization |
| `useRemotePathDrawing` | Visualize remote freehand paths |
| `useRemoteShapeDrawing` | Visualize remote shape drawing |
| `useSharingSocketHandlers` | Handle sharing-related socket events |

### Utility Hooks

| Hook | Purpose |
|------|---------|
| `useClickOutside` | Detect clicks outside element |
| `useEscapeKey` | Detect Escape key press |
| `useDropdownBehavior` | Combines click-outside and escape-key |
| `useKeyboardDelete` | Handle Delete key for object removal |

---

# 6. Frontend Utilities

## 6.1 Core Utilities (client/src/utils/)

### index.ts

```typescript
getWorkspaceId()          // Extract workspace ID from URL
generateUserId()          // Generate unique user ID
getPersistentUserId()     // Get/create persistent user ID
getAccessToken()          // Get access token from storage
setAccessToken()          // Store access token
removeAccessToken()       // Remove access token
constrainObjectToBounds() // Keep objects within canvas viewport
```

### batchedRender.ts

Optimizes canvas rendering by batching multiple requests.

```typescript
const batchedRender = createBatchedRender(canvas);
// Multiple calls result in single render
objects.forEach(obj => {
  obj.set('fill', 'red');
  batchedRender(); // Batched
});
```

### sessionToken.ts

Session token storage with expiration.

```typescript
setSessionToken(key, value);  // Stores with TTL (4 hours)
getSessionToken(key);         // Returns null if expired
```

### shapeGeometry.ts

Geometric calculations for shape drawing.

```typescript
calculateShapeUpdate(shapeType, params) // Returns { props?, points? }
```

Supported shapes: rectangle, circle, ellipse, triangle, star, diamond, pentagon, hexagon, octagon, cross

### fabricArrow.ts

Custom Fabric.js `Arrow` class extending `Line`.

**Properties:**
- `headLength` - Arrowhead length (default: 15)
- `headAngle` - Arrowhead angle (default: pi/6)

## 6.2 Constants (client/src/constants/index.ts)

### Tools
```typescript
const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  TEXT: 'text',
  SHAPES: 'shapes',
  LINE: 'line',
  ARROW: 'arrow',
};
```

### Shapes
```typescript
const SHAPES = {
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'triangle',
  PENTAGON: 'pentagon',
  HEXAGON: 'hexagon',
  OCTAGON: 'octagon',
  DIAMOND: 'diamond',
  STAR: 'star',
  CROSS: 'cross',
};
```

### Zoom
```typescript
const ZOOM = {
  WHEEL_OUT_MULTIPLIER: 0.95,
  WHEEL_IN_MULTIPLIER: 1.05,
  BUTTON_INCREMENT: 0.1,
  MIN: 0.1,
  MAX: 3,
};
```

### Timing
```typescript
const TIMING = {
  DEBOUNCE_DELAY: 250,
  NOTIFICATION_DURATION: 3000,
  MOVEMENT_TIMEOUT: 50,
  RECONNECT_DELAY: 2000,
  CURSOR_THROTTLE: 50,
  CURSOR_TIMEOUT: 5000,
  TOKEN_TTL_MS: 4 * 60 * 60 * 1000, // 4 hours
};
```

---

# 7. Backend Server

## 7.1 Server Core: index.ts

**File:** `server/index.ts`

Main server file initializing Express, Socket.IO, and y-websocket.

### HTTP Endpoints

| Method | Path | Rate Limiter | Description |
|--------|------|--------------|-------------|
| `GET` | `/` | None | Serves index.html |
| `POST` | `/api/workspaces` | `createWorkspaceLimiter` | Creates a new workspace |
| `GET` | `/w/:workspaceId` | None | Serves index.html for workspace routes |
| `GET` | `/api/workspace/:workspaceId` | `apiLimiter` | Checks if workspace exists |

### Rate Limiters

| Name | Window | Max Requests | Message |
|------|--------|--------------|---------|
| `createWorkspaceLimiter` | 60000ms | 10 | "Too many workspaces created, please try again later" |
| `apiLimiter` | 60000ms | 100 | "Too many requests, please try again later" |

### Socket Events

| Event | Rate Limited | Handler | Description |
|-------|--------------|---------|-------------|
| `check-workspace-exists` | No | Inline | Returns workspace existence |
| `join-workspace` | No | `handleJoinWorkspace` | Joins user to workspace |
| `get-sharing-info` | No | Inline | Returns permissions |
| `whiteboard-update` | Yes | `handleWhiteboardUpdate` | Updates elements |
| `whiteboard-clear` | Yes | `handleWhiteboardClear` | Clears whiteboard |
| `delete-element` | Yes | `handleDeleteElement` | Deletes element |
| `text-edit-start` | Yes | `handleTextEditStart` | Acquires text lock |
| `text-edit-end` | Yes | `handleTextEditEnd` | Releases text lock |
| `code-update` | Yes | `handleCodeUpdate` | Updates code |
| `cursor-position` | Yes | Inline | Broadcasts cursor |
| `drawing-start` | Yes | Inline | Starts drawing stream |
| `drawing-stream` | Yes | Inline | Streams points |
| `drawing-end` | Yes | Inline | Ends drawing |
| `shape-drawing-start` | Yes | Inline | Starts shape |
| `shape-drawing-update` | Yes | Inline | Updates shape |
| `shape-drawing-end` | Yes | Inline | Ends shape |
| `change-sharing-mode` | No | `handleChangeSharingMode` | Changes mode |
| `end-session` | No | `handleEndSession` | Ends session |
| `get-active-users` | No | Inline | Returns active users list |
| `get-edit-token` | No | `handleGetEditToken` | Returns edit token (owner only) |
| `set-edit-token` | No | `handleSetEditToken` | Updates edit token (owner only) |

### Background Processes

- **Batch Interval:** Every 50ms, broadcasts queued whiteboard updates
- **Cleanup Interval:** Every 5 minutes, removes inactive workspaces
- **Rate Limit Cleanup:** Every 30 seconds, removes stale rate limit records

## 7.2 Configuration: config.ts

**File:** `server/config.ts`

### Key Configuration Values

| Path | Value | Description |
|------|-------|-------------|
| `port` | `3000` | Server port |
| `socketIO.pingInterval` | `25000` | Ping interval (25s) |
| `socketIO.pingTimeout` | `60000` | Ping timeout (60s) |
| `socketIO.maxHttpBufferSize` | `1e6` | Max buffer (1MB) |
| `cleanup.intervalMs` | `300000` | Cleanup interval (5min) |
| `cleanup.inactiveThresholdMs` | `900000` | Inactive threshold (15min) |
| `batch.interval` | `50` | Batch interval (50ms) |
| `validation.drawing.maxPointsLength` | `10000` | Max drawing points |
| `validation.element.maxIdLength` | `100` | Max element ID length |
| `validation.element.maxTextLength` | `2000` | Max text length |
| `validation.workspace.maxElementsPerUpdate` | `100` | Max elements per update |
| `validation.workspace.maxUsersPerWorkspace` | `100` | Max users |
| `validation.rateLimit.maxEventsPerWindow` | `50` | Max events/second |

## 7.3 Type Definitions: types.ts

**File:** `server/types.ts`

### Core Types

```typescript
interface Workspace {
  id: string;
  created: number;
  lastActivity: number;
  diagrams: Map<string, unknown>;
  drawingsMap: Map<string, WhiteboardElement>;
  allDrawingsMap: Map<string, WhiteboardElement>;
  drawingOrder: string[];
  diagramContent: string;
  codeSnippets: CodeSnippets;
  textEditLocks: Map<string, { userId: string; socketId: string; timestamp: number }>;
  owner: string;
  sharingMode: SharingMode;
  allowedUsers: string[];
  editToken: string;
}

interface UserSession {
  id: string;
  joinedAt: number;
  userId?: string;
  workspaceId?: string;
  accessToken?: string | null;
  hasEditAccess?: boolean;
  isOwner?: boolean;
}

interface HandlerContext {
  socket: Socket;
  io?: Server;
  currentUser: CurrentUser;
  currentWorkspaceRef?: CurrentWorkspaceRef;
  queueUpdate?: (workspaceId: string, elements: WhiteboardElement[], senderSocketId: string) => void;
  workspace?: Workspace;
}
```

## 7.4 Socket Handlers

### workspaceHandlers.ts

**`handleJoinWorkspace`:**
1. Validate workspace ID
2. Ensure workspace exists (create if needed)
3. Check user limit (max 100)
4. Setup user session
5. Leave previous workspace
6. Join new workspace room
7. Emit state events

**`handleDisconnect`:**
1. Release text edit locks
2. Remove connection
3. Emit user-left event

### whiteboardHandlers.ts

**`handleWhiteboardUpdate`:**
- Validates elements (max 100 per update)
- Updates `drawingsMap` and `allDrawingsMap`
- Enforces max drawings limit (5000)
- Queues for batched broadcast

**`handleWhiteboardClear`:**
- Clears all maps
- Broadcasts to room

**`handleDeleteElement`:**
- Removes from maps
- Broadcasts to room

### sharingHandlers.ts

**`handleChangeSharingMode`:**
- Owner-only operation
- Validates mode value
- Broadcasts `sharing-mode-changed`

**`handleEndSession`:**
- Owner-only operation
- Emits `session-ended`
- Disconnects all users except the owner

## 7.5 Services

### workspaceService.ts

```typescript
generateKey(length = 12)                    // Random base64 key
generateEditToken()                         // 'edit_' + 64 hex chars
createWorkspace(workspaceId, ownerId)       // Creates workspace
getWorkspace(workspaceId)                   // Returns workspace
deleteWorkspace(workspaceId)                // Deletes workspace
cleanupInactiveWorkspaces()                 // Returns removed IDs
getWorkspaceState(workspaceId)              // Full state for sync
updateSharingMode(workspaceId, mode)        // Updates mode
```

### permissionService.ts

```typescript
checkWritePermission(workspace, user)            // Returns boolean
checkOwnership(workspace, userId)                // Returns boolean
calculateEditAccess(workspace, user, token)      // Returns { hasEditAccess, isOwner }
getSharingInfo(workspace, user)                  // Returns SharingInfo
validateAndSetToken(workspace, accessToken, user) // Validates token and sets hasEditAccess
```

### batchService.ts

```typescript
queueUpdate(workspaceId, elements, senderId) // Queues for batch
startBatchInterval(io)                       // Starts 50ms interval
cleanupWorkspaceQueues(workspaceIds)         // Cleans up queues
```

### rateLimitService.ts

```typescript
checkRateLimit(socketId, eventName)          // 50 events/second
clearSocketRateLimits(socketId)              // On disconnect
startCleanupInterval()                       // 30 second cleanup
```

## 7.6 Middleware: socketAuth.ts

```typescript
withWorkspaceAuth(handler, options?)  // Room membership + write permission
withRoomAuth(handler)                 // Room membership only
withOwnerAuth(handler, options?)      // Ownership check
```

## 7.7 Yjs Server: yjs-utils.ts

### WSSharedDoc Class

```typescript
class WSSharedDoc extends Y.Doc {
  name: string;                           // Workspace ID
  conns: Map<WebSocket, Set<number>>;     // Connections
  awareness: Awareness;                   // User presence
}
```

### Functions

```typescript
setupWSConnection(conn, req, options?)    // Setup WebSocket connection
cleanupYjsDoc(workspaceId)               // Cleanup on workspace deletion
```

**Rate Limiting:** Max 10 connections/minute per IP

---

# 8. Shared Code

## 8.1 shared/constants.ts

### SOCKET_EVENTS (38 events)

```typescript
const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Workspace
  CHECK_WORKSPACE_EXISTS: 'check-workspace-exists',
  WORKSPACE_EXISTS_RESULT: 'workspace-exists-result',
  JOIN_WORKSPACE: 'join-workspace',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  WORKSPACE_STATE: 'workspace-state',

  // Whiteboard
  WHITEBOARD_UPDATE: 'whiteboard-update',
  WHITEBOARD_CLEAR: 'whiteboard-clear',
  DELETE_ELEMENT: 'delete-element',

  // Drawing
  DRAWING_START: 'drawing-start',
  DRAWING_STREAM: 'drawing-stream',
  DRAWING_END: 'drawing-end',
  SHAPE_DRAWING_START: 'shape-drawing-start',
  SHAPE_DRAWING_UPDATE: 'shape-drawing-update',
  SHAPE_DRAWING_END: 'shape-drawing-end',

  // Code
  CODE_UPDATE: 'code-update',

  // Sharing
  GET_SHARING_INFO: 'get-sharing-info',
  SHARING_INFO: 'sharing-info',
  SHARING_UPDATE: 'sharing-update',
  GET_ACTIVE_USERS: 'get-active-users',
  ACTIVE_USERS_UPDATE: 'active-users-update',
  CHANGE_SHARING_MODE: 'change-sharing-mode',
  SHARING_MODE_CHANGED: 'sharing-mode-changed',

  // Cursor
  CURSOR_POSITION: 'cursor-position',
  CURSOR_UPDATE: 'cursor-update',

  // Text locks
  TEXT_EDIT_START: 'text-edit-start',
  TEXT_EDIT_END: 'text-edit-end',
  TEXT_EDIT_LOCKS: 'text-edit-locks',

  // Tokens
  GET_EDIT_TOKEN: 'get-edit-token',
  SET_EDIT_TOKEN: 'set-edit-token',
  EDIT_TOKEN_UPDATED: 'edit-token-updated',

  // Session
  END_SESSION: 'end-session',
  SESSION_ENDED: 'session-ended',
} as const;

type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
```

### SHARING_MODES (3 modes)

```typescript
const SHARING_MODES = {
  READ_WRITE_ALL: 'read-write-all',
  READ_ONLY: 'read-only',
  READ_WRITE_SELECTED: 'read-write-selected',
} as const;

type SharingMode = typeof SHARING_MODES[keyof typeof SHARING_MODES];
```

---

# 9. Testing

## 9.1 Client Tests

| Test File | Tests |
|-----------|-------|
| `fabricArrow.test.ts` | Arrow initialization, options, rendering, serialization |
| `geometry.test.ts` | Rectangle, circle, triangle, line snapping |
| `sessionToken.test.ts` | Storage, expiration, malformed data |
| `utils.test.ts` | Workspace ID, user ID, boundaries, tokens |

## 9.2 Server Tests

| Test File | Tests |
|-----------|-------|
| `elementValidation.test.ts` | Workspace ID format, element validation |
| `permissionService.test.ts` | Write permission, ownership, edit access |
| `securityUtils.test.ts` | Timing-safe token comparison |
| `socketHandlers.test.ts` | Join, whiteboard, code, tokens, session |
| `workspaceService.test.ts` | CRUD, connections, sessions, cleanup |
| `yjsUtils.test.ts` | Document creation, awareness, text ops |

## 9.3 Load Tests

**Location:** `tests/load/`

### Test Profiles

| Profile | Users | Duration | Description |
|---------|-------|----------|-------------|
| 10 | 10 | 60s | Light load |
| 30 | 30 | 120s | Normal (spec) |
| 50 | 50 | 180s | Heavy |
| 70 | 70 | 180s | Stress |
| 100 | 100 | 300s | Extreme |

### User Behaviors

| Behavior | Weight | Draw | Move | Delete |
|----------|--------|------|------|--------|
| LURKER | 30% | 10% | 5% | 1% |
| NORMAL | 50% | 40% | 30% | 5% |
| ACTIVE | 20% | 70% | 50% | 10% |

### Thresholds

- P95 latency: < 500ms
- P99 latency: < 1000ms
- Error rate: < 5%
- Throughput: > 10 msg/s

---

# 10. Configuration

## 10.1 package.json Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start Vite development server |
| `build` | `vite build` | Build production frontend |
| `server` | `tsx server/index.ts` | Start backend server |
| `start` | `tsx server/index.ts` | Start backend server (alias) |
| `dev:all` | `concurrently "npm run dev" "npm run server"` | Run both concurrently |
| `test` | `node ./node_modules/vitest/vitest.mjs run` | Run tests once |
| `test:watch` | `node ./node_modules/vitest/vitest.mjs` | Run tests in watch mode |
| `test:coverage` | `node ./node_modules/vitest/vitest.mjs run --coverage` | Run tests with coverage |
| `lint` | `eslint .` | Run ESLint |
| `load-test` | `node tests/load/index.js` | Run load tests |
| `load-test:10` | `node tests/load/index.js 10` | Load test with 10 users |
| `load-test:30` | `node tests/load/index.js 30` | Load test with 30 users |
| `load-test:50` | `node tests/load/index.js 50` | Load test with 50 users |
| `load-test:70` | `node tests/load/index.js 70` | Load test with 70 users |
| `load-test:100` | `node tests/load/index.js 100` | Load test with 100 users |
| `load-test:ramp` | `node tests/load/index.js ramp` | Load test with ramping users |
| `load-test:burst` | `node tests/load/index.js burst` | Load test with burst mode |
| `test:docker` | `wsl docker compose exec frontend npm test` | Run tests in Docker (WSL) |
| `heroku-postbuild` | `npm run build` | Heroku deployment build |

## 10.2 TypeScript Configuration (tsconfig.json)

| Option | Value | Description |
|--------|-------|-------------|
| target | ES2022 | ECMAScript target version |
| module | ESNext | Module system |
| moduleResolution | bundler | Module resolution strategy |
| jsx | react-jsx | JSX compilation mode |
| strict | true | Enable all strict options |
| noUnusedLocals | true | Report unused locals |
| noUnusedParameters | true | Report unused parameters |
| noUncheckedIndexedAccess | true | Add undefined to index signatures |
| baseUrl | . | Base directory |
| paths.@/* | ./client/src/* | Path alias |

## 10.3 Vite Configuration (vite.config.js)

| Section | Option | Value |
|---------|--------|-------|
| plugins | - | react(), tailwindcss() |
| root | - | ./client |
| server.port | - | 5173 |
| server.proxy./api | target | localhost:3000 |
| server.proxy./socket.io | ws | true |
| server.proxy./yjs | ws | true |
| build.outDir | - | ../dist |
| build.rollupOptions.manualChunks | monaco | @monaco-editor/react, monaco-editor |
| build.rollupOptions.manualChunks | fabric | fabric |
| build.rollupOptions.manualChunks | mermaid | mermaid |

## 10.4 Vitest Configuration (vitest.config.js)

| Option | Value |
|--------|-------|
| test.globals | true |
| test.environment | node |
| test.setupFiles | ./tests/setup.js |
| test.include | tests/**/*.test.{js,ts} |
| test.coverage.provider | v8 |
| test.coverage.reporter | text, html |

## 10.5 ESLint Configuration (eslint.config.js)

**Ignored:** dist, node_modules, build, coverage

**Rules:**
| Rule | Setting |
|------|---------|
| react/jsx-uses-react | error |
| react/jsx-uses-vars | error |
| no-unused-vars | warn (ignores _-prefixed) |
| no-console | off |
| react-hooks/exhaustive-deps | warn |

---

# 11. DevOps

## 11.1 Dockerfile (Multi-Stage Build)

### Stage 1: builder

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
RUN npm ci --include=optional
COPY client ./client
COPY vite.config.js ./
RUN npm run build
```

### Stage 2: production

```dockerfile
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
COPY shared ./shared
RUN npm ci --include=optional
COPY server ./server
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
```

**Important:** Both stages install ALL dependencies (not production-only) because `tsx` is required at runtime to execute TypeScript server code directly.

## 11.2 docker-compose.yml

### Development Services

**frontend:**
- Image: node:20-alpine
- Port: 5173:5173
- Command: `npm install && npm run dev`
- Environment: VITE_API_URL=http://backend:3000

**backend:**
- Image: node:20-alpine
- Port: 3000:3000
- Command: `npm install && npm run server`

### Production Service

**production:**
- Build: Dockerfile
- Port: 3000:3000
- Profile: prod

### Usage

```bash
# Development mode
docker compose up

# Production mode
docker compose --profile prod up production
```

## 11.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | - | Environment mode |
| PORT | 3000 | Server port |
| VITE_API_URL | http://localhost:3000 | Backend API URL |

---

# 12. Internationalization

## 12.1 Setup

**Path:** `client/src/i18n/index.ts`

- Uses i18next with react-i18next
- Supported languages: English (`en`), Czech (`cs`)
- Default/fallback: Czech
- Detection: URL param, localStorage, default

## 12.2 Namespaces

| Namespace | Content |
|-----------|---------|
| `common` | Buttons, status, accessibility, animals |
| `landing` | Landing page |
| `workspace` | Header, connection, zoom, codeboard |
| `sharing` | Sharing settings |
| `toolbar` | Tools, shapes, controls |
| `editor` | Code and diagram editors |
| `messages` | Confirmations, errors, notifications |
| `validation` | Form validation |

## 12.3 Key Examples

**Buttons:**
```json
{
  "buttons.create": "Create",
  "buttons.cancel": "Cancel",
  "buttons.copy": "Copy",
  "buttons.copied": "Copied!"
}
```

**Animals (for cursor names):**
```json
{
  "animals.fox": "Fox",
  "animals.owl": "Owl",
  "animals.wolf": "Wolf"
}
```

---

# Appendix

## A. Quick Start

```bash
# Install dependencies
npm install

# Development (frontend + backend)
npm run dev:all

# Access at http://localhost:5173
```

## B. Docker Quick Start

```bash
# Development
docker compose up

# Production
docker compose --profile prod up production --build
```

## C. Testing

```bash
# Run all tests
npm test

# With coverage
npm run test:coverage

# Load test (30 users)
npm run load-test:30
```

## D. Production Build

```bash
# Build frontend
npm run build

# Start server (serves built frontend)
npm start
```

## E. URL Structure

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/w/{workspaceId}` | Workspace |
| `/w/{workspaceId}?access={token}` | Workspace with edit token (token is cleared from URL after reading) |

---

**End of Documentation**
