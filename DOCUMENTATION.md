# ShareBoard - Technical Documentation

**Version:** 1.0.0
**Last Updated:** 2026-03-04
**Tech Stack:** React 19 + Vite 7 + TailwindCSS 4 + TypeScript (Frontend), Node.js + Express 5 + Socket.IO + Yjs (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Frontend Core](#3-frontend-core)
4. [Frontend Pages](#4-frontend-pages)
5. [Frontend Components](#5-frontend-components)
6. [Frontend State Management](#6-frontend-state-management)
7. [Frontend Hooks](#7-frontend-hooks)
8. [Frontend Utilities](#8-frontend-utilities)
9. [Frontend Factories](#9-frontend-factories)
10. [Frontend Types, Constants, i18n](#10-frontend-types-constants-i18n)
11. [Backend Server](#11-backend-server)
12. [Shared Code](#12-shared-code)
13. [Testing](#13-testing)
14. [Configuration](#14-configuration)
15. [Project Setup](#15-project-setup)

---

# 1. Project Overview

## 1.1 What is ShareBoard?

ShareBoard is a real-time collaborative whiteboard and code editor. Multiple users can work in the same workspace at the same time:

- **Draw** on a canvas (shapes, lines, text, freehand)
- **Edit code** with syntax highlighting
- **Create diagrams** with Mermaid syntax and live preview
- **See each other's cursors** in real time

## 1.2 Key Features

| Feature | Description |
|---------|-------------|
| Interactive Canvas | Fabric.js whiteboard with shapes, lines, arrows, text, freehand drawing |
| Code Editor | Monaco Editor with multi-language syntax highlighting |
| Diagram Support | Mermaid diagram rendering with live preview |
| Real-time Sync | Socket.IO for whiteboard, Yjs CRDT for code/diagrams |
| Sharing Modes | Read-only, Read-write-all, Read-write-selected (token-based) |
| Multi-language | English and Czech localization |
| 30+ Users | Supports 30+ concurrent users per workspace |

## 1.3 Technology Stack

### Frontend
- React 19 with concurrent rendering
- Vite 7 for build tooling
- TailwindCSS 4 for styling
- TypeScript with strict mode
- Fabric.js 6.9 for canvas manipulation
- Monaco Editor for code editing
- Yjs + y-monaco for collaborative text editing
- Socket.IO Client for real-time communication
- Mermaid for diagram rendering
- i18next for internationalization

### Backend
- Node.js 20+ runtime
- Express 5 web framework
- Socket.IO WebSocket server
- y-websocket Yjs server
- Helmet security headers
- Zod runtime validation

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
    {/* Below here is inside the Workspace page component */}
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
| HTTP | Helmet headers (CSP, Referrer-Policy: strict-origin), CORS, rate limiting |
| Socket.IO | Per-socket rate limiting, room auth, write permissions on all drawing events |
| Yjs | Per-IP rate limiting, workspace validation |
| Tokens | Timing-safe comparison, `edit_` prefix validation, URL cleared after reading |

---

# 3. Frontend Core

## 3.1 Entry Point (main.tsx, index.html)

`client/index.html` is a minimal HTML shell. It loads three Google Fonts (Inter, JetBrains Mono, Outfit) via `<link>` tags, defines a `<div id="root">` mount target, and includes the Vite module entry `<script type="module" src="/src/main.tsx">`.

`client/src/main.tsx` boots the React app. It imports the i18n configuration (`./i18n`), the root `App` component, and the global stylesheet `./index.css`. It grabs the `#root` DOM element, throws if missing, and calls `ReactDOM.createRoot(rootElement).render(<App />)`. There is no `<StrictMode>` wrapper.

The provider hierarchy at the top level:

```
SocketProvider
  -> RouterProvider (react-router-dom)
      -> ToastContainer (react-toastify)
```

`SocketProvider` wraps the entire tree, so the Socket.IO connection is available on every route, including the landing page (used there for workspace existence checks).

The `ToastContainer` (react-toastify) is configured with `TOAST.POSITION` (bottom-right) and `newestOnTop={false}`.

## 3.2 Routing (App.tsx)

`client/src/App.tsx` uses `createBrowserRouter` from react-router-dom v7 with explicit v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`, `v7_normalizeFormMethod`, `v7_partialHydration`, `v7_skipActionErrorRevalidation`, `v7_fetcherPersist`).

Routes:

| Path | Component | Purpose |
|---|---|---|
| `/` | `<LandingPage />` | Home page: create or join workspace |
| `/w/:workspaceId` | `<Workspace />` | Main collaborative workspace |
| `*` | `<Navigate to="/" replace />` | Catch-all redirect to home |

## 3.3 Styling (index.css)

`client/src/index.css` uses the Tailwind CSS v4 `@import "tailwindcss"` directive.

**Theme tokens** defined in `@theme`:
- Custom animations: `fadeIn`, `slideUp`, `pulse-slow`
- Custom colors via OKLCH: `--color-primary`, `--color-primary-dark`, `--color-success`, `--color-warning`, `--color-danger`

**Custom cursors**: The `:root` block defines two CSS custom properties (`--custom-cursor` and `--custom-cursor-pointer`) that embed inline SVG cursors (a blue arrow pointer). These are applied globally via `body, body *` and interactive element selectors.

**Utility classes** (using `@apply`):
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.btn-icon`, `.btn-icon-active`
- Dropdowns: `.dropdown-base`, `.dropdown-top`, `.dropdown-side`, `.dropdown-menu`, `.dropdown-item`
- Color swatches: `.color-swatch`, `.color-swatch-selected`, `.color-swatch-hover`
- Forms: `.input`, `.card`, `.modal-overlay`, `.modal-content`
- Toolbar: `.toolbar`, `.toolbar-panel`, `.toolbar-section`, `.toolbar-divider`, `.toolbar-divider-v`, `.toolbar-action-btn`, `.toolbar-readonly-indicator`
- Badges: `.badge`, `.badge-warning`, `.badge-success`, `.badge-info`, `.badge-readonly`
- Notifications: `.notification`, `.notification-success`, `.notification-warning`, `.notification-error`, `.notification-info`
- Header: `.header-panel`, `.header-home-btn`, `.header-divider`, `.header-title`, `.header-workspace-id` (non-button variant), `.header-workspace-id-btn`, `.header-readonly-badge`
- Landing page: `.landing-card`, `.landing-title`, `.landing-subtitle`, `.landing-btn-primary`, `.landing-btn-secondary`, `.landing-input`, `.landing-divider`, `.landing-error`, `.landing-features` (defined but unused by component), `.landing-lang-switcher`, `.demo-background`, `.demo-svg`, `.demo-blur-overlay`, `.landing-content`, `.floating-cursor`
- Canvas: `.canvas-grid`, `.resize-handle`
- Remote cursors: `.remote-cursor`, `.remote-cursor-label`
- Users panel: `.users-panel`, `.users-panel-header`, `.users-panel-list`
- Options menu: `.options-menu-item`
- Forms: `.form-radio-item`
- Scrollbar: `.scrollbar-thin`

**Diagram rendering**: `.diagram-container svg` styles force transparent fill on nodes, dark stroke colors (`#333`), and remove default Mermaid backgrounds. A `diagramFadeIn` animation is applied to new SVGs.

**Yjs remote selections**: `.yRemoteSelection` and `.yRemoteSelectionHead` style collaborative cursor indicators in Monaco editors with purple highlighting and name labels.

**Responsive**: At `max-width: 640px`, toolbar padding and button sizes shrink. A `prefers-reduced-motion` media query disables all animations.

**Keyframe animations**: `fadeIn`, `slideUp`, `toolbarSlideIn`, `dropdownFadeIn`, `cardEntrance`, `titleReveal`, `subtitleReveal`, `btnReveal`, `btnSecReveal`, `dividerReveal`, `inputReveal`, `featuresReveal`, `langReveal`, `shake`, `floatCursor`, `pulseRing`, `headerSlideIn`, `slideInRight`, `cursorLabelFadeIn`, `diagramFadeIn`.

---

# 4. Frontend Pages

## 4.1 LandingPage

**File**: `client/src/pages/LandingPage.tsx`

Renders the entry screen with two actions: create a new workspace, or join an existing one by key.

**Background**: Lazy-loads `<DemoWhiteboard />` inside `<Suspense>`, which renders animated shapes behind the UI. A `<LanguageSwitcher />` sits in the bottom-left corner. Three decorative `<FloatingCursor>` components float around the page using CSS animations.

**Create workspace**: The `createWorkspace` async function sends a `POST /api/workspaces` request with a `userId` from `getPersistentUserId()`. On success, it navigates to `/w/${data.workspaceId}`. On failure, it sets an error string displayed in `.landing-error`.

**Join workspace**: The `joinWorkspace` callback (triggered on form submit) emits `SOCKET_EVENTS.CHECK_WORKSPACE_EXISTS` with the entered key and listens for `SOCKET_EVENTS.WORKSPACE_EXISTS_RESULT`. If `exists` is true, it navigates to `/w/${key}`. If false, it shows a toast error. A 5-second timeout guards against no response. The socket connection comes from `useSocket()`.

**State**: `workspaceKey` (input value), `isLoading` (create in progress), `isJoining` (join in progress), `error` (create failure message). A `joinTimeoutRef` prevents stale callbacks.

**Translations**: Uses `react-i18next` with namespaces `landing`, `common`, and `messages`.

## 4.2 Workspace

**File**: `client/src/pages/Workspace.tsx`

This is the main collaborative page. It consists of three nested components that build up the provider tree:

**`Workspace`** (exported default): Extracts `workspaceId` from URL params. Wraps everything in `<SharingProvider workspaceId={...}>`, then renders `<WorkspaceGate>`.

**`WorkspaceGate`**: Checks `isCheckingWorkspace` and `workspaceNotFound` from `useSharing()`. While checking, shows a loading spinner. If not found, shows a toast error and navigates to `/`. Once verified, renders the provider tree:

```
YjsProvider
  -> WhiteboardProvider
      -> CodeEditorProvider
          -> DiagramEditorProvider
              -> WorkspaceLayout
```

**`WorkspaceLayout`**: The main layout component. It holds state for:
- `viewMode`: `'whiteboard'` or `'split'`
- `splitPosition`: percentage width of the code panel (persisted to localStorage via `STORAGE_KEYS.SPLIT_POSITION`)
- `isDragging`: panel resize in progress
- `showSharingSettings`: modal visibility
- `isNewWorkspace`: flag from server to auto-open sharing settings for the owner
- `initialMouseX`: starting X position for resize drag
- `initialWidth`: starting panel width for resize drag
- `persistentUserId`: from `getPersistentUserId()`, used for session identity

It computes an aggregate `connectionStatus` from the socket, whiteboard, and Yjs connection states. It listens for `SOCKET_EVENTS.WORKSPACE_STATE` (to detect new workspaces) and `SOCKET_EVENTS.SESSION_ENDED` (to show a toast and redirect home after 2 seconds).

The split panel resize is handled via `handleMouseDown(e, direction)`, `mousemove`, and `mouseup` global listeners. Note: `WorkspaceLayout` defines `handleMouseDown` with 1 argument (mouse event), while `WorkspaceContent` types it with 2 arguments `(e: ReactMouseEvent<HTMLDivElement>, direction: 'left' | 'right')`. The split position is clamped between `LAYOUT.MIN_WIDTH_PERCENT` and `LAYOUT.MAX_WIDTH_PERCENT`.

A full-screen overlay shows connection status (connecting spinner, loading history, disconnected warning, error message) when not fully connected.

---

# 5. Frontend Components

## 5.1 Main Components

### Whiteboard

**File**: `client/src/components/Whiteboard.tsx`

```tsx
interface WhiteboardProps {
  disabled?: boolean;
  onCursorMove?: (x: number, y: number) => void;
}
```

Renders a `<canvas>` element wrapped in a `div.canvas-grid`. The Fabric.js canvas is initialized via `useWhiteboard().initCanvas(canvasRef.current)` inside a `useEffect`.

Delegates drawing logic to custom hooks:
- `useShapeDrawing`: rectangle, circle, ellipse, triangle, etc. via mouse drag
- `useLineDrawing`: line and arrow drawing
- `useTextEditing`: click-to-add-text
- `useObjectModification`: object move/resize sync
- `useCanvasPanning`: middle-mouse/space+drag panning and wheel zoom
- `useKeyboardDelete`: Delete/Backspace key on selected objects

Mouse event routing in `handleMouseDown`:
- `TOOLS.TEXT` + no target: calls `addText(pointer)`
- `TOOLS.SHAPES` + no target: calls `startShape(pointer)`
- `TOOLS.LINE` / `TOOLS.ARROW` + no target: calls `startLine(pointer)`

The component also listens for `FABRIC_EVENTS.OBJECT_MODIFIED` to track `originalState` of objects before modification, enabling undo-aware sync. `ctrlKey` and `shiftKey` modifiers from mouse events are forwarded to shape drawing hooks for constrained drawing (e.g., Ctrl for square/equilateral, Shift for line snapping).

Text edit locking: Listens for `SOCKET_EVENTS.TEXT_EDIT_LOCKS` to track which text objects are being edited by other users. When entering text editing, emits `SOCKET_EVENTS.TEXT_EDIT_START`. On exiting, commits the final text via `updateElement` and emits `SOCKET_EVENTS.TEXT_EDIT_END`. Objects locked by other users have `editable` set to false.

Wrapped in `React.memo`.

### CodeEditor

**File**: `client/src/components/CodeEditor.tsx`

```tsx
interface CodeEditorProps {
  onAddToWhiteboard?: () => void;
  onEmptyWarning?: () => void;
  canAddToWhiteboard?: boolean;
}
```

Renders a Monaco editor (`@monaco-editor/react`) with a toolbar above it. The toolbar contains a language selector dropdown (from `CODE_EDITOR_LANGUAGES`), an "Insert Example" button, and an "Add to Whiteboard" button (visible only when `canAddToWhiteboard` is true).

Yjs integration: On editor mount, creates a `MonacoBinding` linking the Yjs `doc.getText('code')` shared text to the Monaco model. This allows real-time collaborative editing through `y-monaco`. The binding is destroyed on unmount.

Read-only mode is determined by `useSharing().canWrite()`.

The language selector dropdown uses `useClickOutside` for click-outside dismissal. The "Insert Example" button inserts content from the `CODE_EXAMPLES` constant (one example per language).

Language changes are handled via `useCodeEditor().setLanguage()`, which also emits a socket event to sync language across clients.

### CodeEditorPanel

**File**: `client/src/components/CodeEditorPanel.tsx`

```tsx
interface CodeEditorPanelProps {
  canWrite: () => boolean;
  onAddDiagramToWhiteboard: () => void;
  onAddCodeToWhiteboard: () => void;
  onCodeEmptyWarning: () => void;
  onClose: () => void;
}
```

A tabbed container with two tabs: "Code" and "Diagram", plus a close button. The `activeTab` state (`'code'` | `'diagram'`) determines which child component is rendered: `<CodeEditor>` or `<DiagramRenderer>`. Shows a read-only badge when `canWrite()` returns false.

### DiagramRenderer

**File**: `client/src/components/DiagramRenderer.tsx`

```tsx
interface DiagramRendererProps {
  onAddToWhiteboard: () => void;
  canAddToWhiteboard: boolean;
}
```

A split-pane component with a Monaco editor (top) for Mermaid diagram syntax and a live SVG preview (bottom). The split is resizable via mouse drag on a divider bar. `editorHeight` state controls the split ratio (initial value `50`, clamped between 20% and 80%).

Mermaid is loaded asynchronously via `loadMermaid()` with the following `MERMAID_CONFIG`: `startOnLoad: false`, `theme: 'neutral'`, `logLevel: 'error'`, `securityLevel: 'strict'`, and a `flowchart` sub-config (`curve: 'linear'`, `useMaxWidth: false`, `padding: 15`). Diagram content comes from `useDiagramEditor().content`. Rendering is debounced at 400ms (first render is immediate). Errors are parsed into user-friendly messages with line numbers when available.

The preview area supports pan (click+drag) and zoom (mouse wheel). A "Reset" button appears when zoom or pan differs from defaults. Zoom is clamped between `ZOOM.MIN` and `ZOOM.MAX`.

Yjs integration: Creates a `MonacoBinding` on `doc.getText('diagram')` for collaborative diagram editing.

SVG output is sanitized via DOMPurify before being injected into the DOM.

### SharingSettings

**File**: `client/src/components/SharingSettings.tsx`

```tsx
interface SharingSettingsProps {
  workspaceId: string;
  onClose: () => void;
}
```

A modal dialog for managing workspace sharing permissions. Shows different UI for owners vs non-owners.

**Owner view**: Three radio buttons for sharing modes (`READ_ONLY`, `READ_WRITE_ALL`, `READ_WRITE_SELECTED`). Calls `changeMode()` from `useSharing()` on selection. Below, shows two link sections: a "view link" (the workspace URL) and an "edit link" (workspace URL with `?access=` token). The edit token is fetched via `SOCKET_EVENTS.GET_EDIT_TOKEN`. Both have copy-to-clipboard buttons.

On mount, the component emits `SOCKET_EVENTS.GET_SHARING_INFO` and `SOCKET_EVENTS.GET_ACTIVE_USERS` to refresh sharing state and active user list.

**Non-owner view**: Shows the current sharing mode label and description as read-only information, with a message that only the owner can change settings.

### WorkspaceContent

**File**: `client/src/components/WorkspaceContent.tsx`

```tsx
interface WorkspaceContentProps {
  workspaceId: string;
  viewMode: ViewMode;
  splitPosition: number;
  isDragging: boolean;
  handleMouseDown: (e: ReactMouseEvent<HTMLDivElement>, direction: 'left' | 'right') => void;
  containerRef: RefObject<HTMLDivElement | null>;
  cycleViewMode: () => void;
  onShareClick: () => void;
}
```

The primary workspace layout component. Renders:
- `<Header>` (top-left, absolute positioned)
- `<Toolbar>` (left side, vertically centered)
- `<Whiteboard>` (full area, with `<RemoteCursors>` and `<ZoomControls>` overlaid)
- `<CodeEditorPanel>` (right side, visible only in `split` view mode)
- `<Notification>` (centered bottom)
- `<ConnectionStatus>` and `<LanguageSwitcher>` (bottom-left)

In split mode, the code panel occupies `splitPosition`% of the width from the right side. Two resize handles (left and right edges) allow dragging.

The component maintains `viewportTransform` state, used for computing cursor positions relative to the canvas coordinate system.

Hooks `useDiagramToCanvas` and `useCodeToCanvas` convert diagram SVG / code text into Fabric.js objects on the whiteboard. `useCursorSync` handles remote cursor position broadcast and collection.

Monitors `canWrite()` changes and shows notifications when edit access is granted or revoked.

## 5.2 Layout Components

### Header

**File**: `client/src/components/layout/Header.tsx`

```tsx
interface HeaderProps {
  workspaceId: string;
  canWrite: () => boolean;
}
```

Renders a floating panel (`.header-panel`) in the top-left corner containing:
- A home button that navigates to `/`
- A vertical divider
- The workspace ID displayed in monospace font, clickable to copy to clipboard. Uses `toast.success` / `toast.error` for clipboard feedback.
- A read-only badge (lock icon + text) when `canWrite()` returns false

Wrapped in `React.memo`.

### Toolbar

**File**: `client/src/components/layout/Toolbar.tsx`

Renders a vertical toolbar panel (`.toolbar-panel`) with sections:

1. **Select tool** (`ToolButton` with `MouseIcon`), always visible
2. **Drawing tools** (only when `canWrite()` is true):
   - `PenButton`: pen with color/width settings dropdown
   - `ShapesMenu`: shapes, lines, arrows dropdown
   - `TextButton`: text tool with font size dropdown
3. **Read-only indicator**: a lock icon shown when `canWrite()` is false
4. **Actions section**:
   - Share button (blue icon for owners)
   - `OptionsMenu`: export, clear, end session

Wrapped in `React.memo`.

**Barrel export**: `client/src/components/layout/index.ts` re-exports `Header` and `Toolbar`.

## 5.3 UI Components

### ColorPicker

Shows a row (or column when `vertical`) of basic color swatches (`BASIC_COLORS` from constants). A "more colors" button opens a dropdown with `BRUSH_COLORS` in a 4-column grid plus a native `<input type="color">` picker. Tracks recently used custom colors in localStorage under `RECENT_COLORS_KEY`, up to `MAX_RECENT_COLORS`. Uses `useDropdownBehavior` hook for click-outside dismissal.

### ConfirmDialog

A modal confirmation dialog rendered via `createPortal` to `document.body`. Supports three variants (`danger`, `warning`, `primary`) with different icon and button colors. Closes on Escape key or backdrop click. Auto-focuses the confirm button on open. Prevents body scroll while open.

### ConnectionStatus

Renders a colored dot and text label reflecting the connection state: connected (green), connecting (yellow), disconnected (yellow), error (red). When connected, shows participant count in parentheses. Has `role="status"` and `aria-live="polite"` for accessibility.

### ExportPreviewModal

A portal-rendered modal for exporting the whiteboard as PNG. Shows a preview image with three export modes:
1. Full canvas (no selection)
2. "Select All" (crops to `objectsBounds`)
3. Custom rectangle selection drawn by click+drag on the preview

The `handleDownload` function creates an offscreen `<canvas>`, draws the cropped region, and calls `onDownload` with the data URL.

### LanguageSwitcher

A button toggling between English (`en`) and Czech (`cs`). Calls `i18n.changeLanguage()` and persists the choice to localStorage under `STORAGE_KEYS.LANGUAGE`. Displays "EN" or "CZ".

### Notification

A fixed-position toast at the bottom center of the screen. Auto-hides after `duration` ms (default from `TIMING.NOTIFICATION_DURATION`). Uses opacity + translateY transitions for enter/exit animation. Each type has a distinct background color and SVG icon.

### NumberInput

A numeric `<input type="number">` with min/max clamping on both change and blur events. If the user types a value above max, it clamps to max immediately. On blur, values below min are clamped up.

### OptionsMenu

A hover-expandable menu in the toolbar. The trigger is an `ExpandMoreIcon` button. On hover, reveals action buttons:
- **Export**: Opens `<ExportPreviewModal>`, gets the full canvas image via `getFullCanvasImage()`, triggers a PNG download via a temporary `<a>` element
- **Clear whiteboard**: Opens a `<ConfirmDialog>` (danger variant). On confirm, emits `SOCKET_EVENTS.WHITEBOARD_CLEAR` and calls `onClearCanvas()`. Hidden in read-only mode.
- **End session**: Owner-only. Opens a `<ConfirmDialog>`. On confirm, emits `SOCKET_EVENTS.END_SESSION`.

Uses a 200ms delay (`HOVER_CLOSE_DELAY`) before closing on mouse leave.

### PenButton

A toolbar button with a `CreateIcon`. When active, clicking opens a dropdown with:
- A brush width slider (range input + `NumberInput`) clamped between `CANVAS.MIN_BRUSH_WIDTH` and `CANVAS.MAX_BRUSH_WIDTH`
- A 6-column color grid from `BRUSH_COLORS`
- A native `<input type="color">` for custom colors

A small colored dot in the bottom-right corner of the button shows the current color. Returns `null` when `disabled`.

### RemoteCursors

Renders other users' cursor positions on the whiteboard. Each `RemoteCursor` is positioned using CSS `transform: translate3d(...)` computed from the canvas viewport transform matrix. This accounts for pan and zoom so cursors appear at the correct canvas coordinates. A colored SVG arrow icon and a name label are displayed. Transition is 50ms linear, matching the cursor sync throttle interval.

Returns `null` when there are no remote cursors.

### ShapesMenu

A toolbar button with a `GroupedShapesIcon` that opens a 4-column dropdown grid of 12 items: rectangle, circle, ellipse, triangle, pentagon, hexagon, octagon, diamond, star, cross, line, and arrow. Receives a `vertical` prop for vertical layout. Selecting a shape sets both `tool` and `selectedShape`. For line/arrow, `selectedShape` is set to null and `tool` is set to `TOOLS.LINE` or `TOOLS.ARROW`.

### TextButton

A toolbar button with `TextFieldsIcon`. Shows the current font size as a small badge on the button. When active, clicking opens a dropdown with:
- A 3-column grid of preset sizes from `FONT_SIZES`
- A custom size `NumberInput` clamped between `CANVAS.MIN_FONT_SIZE` and `CANVAS.MAX_FONT_SIZE`

### ToolButton

A generic toolbar button that renders any MUI `SvgIconComponent`. Applies `.btn-icon-active` when active. Has `aria-pressed` for accessibility. Disabled state adds opacity and prevents click.

### WidthSlider

A range input for brush width. Supports horizontal and vertical (using `writing-mode: vertical-lr`) orientations. Clamped between `CANVAS.MIN_BRUSH_WIDTH` and `CANVAS.MAX_BRUSH_WIDTH`. Returns `null` when `disabled`.

### ZoomControls

Fixed-position controls at the bottom-right. Shows:
- Current zoom percentage
- Minus button (decrements by `ZOOM.BUTTON_INCREMENT`, min `ZOOM.MIN`)
- Plus button (increments by `ZOOM.BUTTON_INCREMENT`, max `ZOOM.MAX`)
- A help button that shows keyboard shortcuts on hover (from `CONTROL_TIPS` constant)

**Barrel export**: `client/src/components/ui/index.ts` re-exports all 15 UI components.

## 5.4 Demo Components

### DemoWhiteboard

**File**: `client/src/components/demo/DemoWhiteboard.tsx`

An animated background for the landing page. Renders SVG shapes (rectangles, circles, ellipses, triangles, pentagons, hexagons, octagons, diamonds, stars, crosses) that spawn, fade in, and fade out over time.

Configuration constants:
- `SHAPE_LIFETIME`: 12000ms
- `FADE_DURATION`: 1000ms
- `SPAWN_INTERVAL`: 120ms
- `INITIAL_SHAPES`: 25
- `MAX_SHAPES`: 100
- Grid: 6 columns, 5 rows

Shapes are distributed across a grid to avoid clustering. Each shape has a random type, position within its grid cell, size (45-115px), and color from the `COLORS` palette. A cleanup interval removes expired shapes every 100ms.

Wrapped in `React.memo`. The window resize handler updates the coordinate system.

---

# 6. Frontend State Management

## 6.1 SocketContext

**File**: `client/src/context/SocketContext.tsx`

**State held**:

```tsx
interface SocketContextValue {
  socket: Socket | null;
  connectionStatus: ConnectionStatusType;  // 'connected' | 'connecting' | 'disconnected' | 'error'
  connectionError: string | null;
  connectionAttempts: number;
  maxReconnectAttempts: number;
  userId: string | null;
}
```

Creates a single `socket.io-client` instance via `io()`. The server URL comes from the `VITE_API_URL` env variable, falling back to `http://localhost:3000` in dev mode. Socket options include auto-connect, reconnection with configurable attempts (`SOCKET.MAX_RECONNECT_ATTEMPTS`), delays from `TIMING` constants, and dual transport (websocket + polling).

Socket event handlers:
- `connect`: resets attempts and error, sets status to `CONNECTED`, shows success toast
- `connect_error`: sets status to `ERROR`, increments attempts, shows warning toast. At max attempts, disconnects and shows error toast.
- `disconnect`: sets status to `DISCONNECTED`, nullifies socket, shows info toast
- `error`: stores error message, shows error toast

The `userId` is a persistent identifier retrieved from `getPersistentUserId()` (stored in localStorage).

**Provider pattern**: `<SocketProvider>` wraps the entire app in `App.tsx`. Hook: `useSocket()`.

## 6.2 SharingContext

**File**: `client/src/context/SharingContext.tsx`

**State held**:

```tsx
interface SharingContextValue {
  sharingMode: SharingModeType;
  allowedUsers: string[];
  isOwner: boolean;
  currentUser: string | null;
  hasEditAccess: boolean;
  canWrite: () => boolean;
  changeMode: (mode: SharingModeType) => void;
  workspaceOwner: string | null;
  sharingInfoReceived: boolean;
  workspaceNotFound: boolean;
  isCheckingWorkspace: boolean;
  accessToken: string | null;
}
```

On mount, checks for an `access` query parameter in the URL. If found, stores it as a session token and removes it from the URL via `history.replaceState`. On socket connect, emits `CHECK_WORKSPACE_EXISTS`. On result, either proceeds to join or sets `workspaceNotFound`. Joining emits both `GET_SHARING_INFO` and `JOIN_WORKSPACE` with the userId and accessToken.

`canWrite()` logic:
- Owner: always true
- `READ_ONLY` mode: always false
- `READ_WRITE_ALL` mode: always true
- `READ_WRITE_SELECTED` mode: true only if `hasEditAccess` is true (granted via edit token)

`changeMode()`: Owner-only. Emits `SOCKET_EVENTS.CHANGE_SHARING_MODE`.

**Provider pattern**: `<SharingProvider workspaceId={...}>` wraps `WorkspaceGate`. Hook: `useSharing()`.

## 6.3 YjsContext

**File**: `client/src/context/YjsContext.tsx`

**State held**:

```tsx
interface YjsContextValue {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  status: 'disconnected' | 'connecting' | 'connected';
  synced: boolean;
}
```

Creates a `Y.Doc` instance and a `WebsocketProvider` from `y-websocket`. The WebSocket URL is constructed as `ws[s]://<host>/yjs?userId=...&accessToken=...`. The provider connects to the room identified by `workspaceId`.

Awareness state is set with user info (id, name from translated animal names, color picked deterministically from seed, animal key). This awareness data powers collaborative cursor display in Monaco editors.

Status and sync state are tracked via `provider.on('status', ...)` and `provider.on('sync', ...)`. A warning toast is shown if the connection drops after previously being connected.

The provider is only created after `sharingInfoReceived` is true, so authentication data is available before connecting.

**Provider pattern**: `<YjsProvider workspaceId={...}>` wraps the whiteboard/editor providers. Hook: `useYjs()`.

## 6.4 WhiteboardContext

**File**: `client/src/context/WhiteboardContext.tsx`

This is the largest context. It composes several hooks:

- **`useWhiteboardCanvas`**: Manages the Fabric.js `Canvas` instance, refs (`canvasRef`, `isUpdatingRef`, `elementsMapRef`, `batchedRenderRef`), canvas initialization/disposal, full canvas image export, drawing mode settings, and throttled socket emission.
- **`useWhiteboardElements`**: Manages the `elements` array, `createFabricObject` factory, and CRUD operations (`addElement`, `updateElement`, `deleteElement`, `clearElements`).
- **`useWhiteboardSync`**: Handles socket-based element synchronization. Listens for `CONNECT`, `DISCONNECT`, `WORKSPACE_STATE` (initial load), `WHITEBOARD_UPDATE`, `WHITEBOARD_CLEAR`, `DELETE_ELEMENT`, `USER_JOINED`, `USER_LEFT`. Tracks `isConnected`, `isLoading`, `connectionStatus`, `activeUsers`.
- **`useWhiteboardTools`**: Manages tool, shape, color, width, fontSize state. Configures Fabric.js drawing mode (freeDrawingBrush) when pen tool is active.
- **`useRemoteDrawing`**: Handles real-time brush stroke rendering from other users while they are still drawing.

`setZoom`: Clamps to `[ZOOM.MIN, ZOOM.MAX]`, calls `canvas.zoomToPoint()` at the canvas center, and triggers a batched render.

`addElement`: Adds an element to the local elements map and canvas, then emits to the socket for remote sync.

`updateElement`: Updates an existing element locally and emits the change via throttled socket emission.

`clearCanvas`: Removes all elements from the canvas and map, emits clear event.

**Provider pattern**: `<WhiteboardProvider>` wraps the workspace content. Hook: `useWhiteboard()`.

## 6.5 CodeEditorContext

**File**: `client/src/context/CodeEditorContext.tsx`

**State held**:

```tsx
interface CodeEditorContextValue {
  content: string;
  language: string;
  setContent: (value: string) => void;
  setLanguage: (language: string) => void;
}
```

Content is synced via Yjs using `doc.getText('code')`. An observer on the Y.Text instance updates local `content` state whenever the shared text changes. When no content exists and the doc is synced, initializes with `CODE_EXAMPLES[language]` (guarded by a `codeInitialized` meta flag to prevent duplication).

`setContent` replaces the entire Y.Text content within a transaction (delete all, then insert).

Language is synced via Socket.IO: `setLanguage` calls `socket.emit(SOCKET_EVENTS.CODE_UPDATE, { workspaceId, language })`. Incoming `CODE_UPDATE` events update the local language state. The `WORKSPACE_STATE` event provides initial language and content.

**Provider pattern**: `<CodeEditorProvider>` wraps inside `WhiteboardProvider`. Hook: `useCodeEditor()`.

## 6.6 DiagramEditorContext

**File**: `client/src/context/DiagramEditorContext.tsx`

**State held**:

```tsx
interface DiagramEditorContextValue {
  content: string;
  setContent: (value: string) => void;
  isReadOnly: boolean;
}
```

Content is synced via Yjs using `doc.getText('diagram')`. An observer syncs Y.Text changes to local state. When the document is synced and the diagram text is empty, initializes with `SAMPLE_DIAGRAM` (guarded by a `diagramInitialized` meta flag).

`setContent` performs a diff-based update: it computes the common prefix and suffix, then applies only the minimal delete+insert operations to the Y.Text. This avoids unnecessary Yjs operations for small edits. If `isReadOnly` is true, `setContent` is a no-op.

**Provider pattern**: `<DiagramEditorProvider>` wraps inside `CodeEditorProvider`. Hook: `useDiagramEditor()`.

---

# 7. Frontend Hooks

## 7.1 Canvas / Whiteboard Hooks

### useWhiteboardCanvas

**File:** `client/src/hooks/useWhiteboardCanvas.ts`

Initializes and manages the Fabric.js canvas instance: free drawing brushes, path creation events, object modification events, window resize handling, and drawing stream integration.

**Returns:** `UseWhiteboardCanvasReturn`

```ts
interface UseWhiteboardCanvasReturn {
  canvasRef: MutableRefObject<Canvas | null>;
  isUpdatingRef: MutableRefObject<boolean>;
  elementsMapRef: MutableRefObject<Map<string, Element>>;
  batchedRenderRef: MutableRefObject<(() => void) | null>;
  initCanvas: (canvasElement: HTMLCanvasElement, callbacks: InitCanvasCallbacks) => () => void;
  disposeCanvas: () => void;
  getFullCanvasImage: () => CanvasImageData | null;
  setCanvasDrawingMode: (isDrawing: boolean, color: string, width: number) => void;
  setRefs: (socket: Socket | null, canWrite: (() => boolean) | null, userId: string | null) => void;
  emitThrottled: (workspaceId: string, elements: Element[]) => boolean;
}
```

Key side effects:
- Creates a `Canvas` with `renderOnAddRemove: false`, `skipOffscreen: true`, `preserveObjectStacking: true`, fire right/middle click, and context menu suppression.
- Sets up a `PencilBrush` with round caps and joins.
- Attaches `path:created`, `object:modified`, and `object:moving` Fabric event listeners.
- Calls `setupDrawingStreamHandlers` from `useDrawingStream` for real-time path streaming.
- Listens for `window.resize` and resizes the canvas.
- On `path:created`, assigns a UUID to the path, stores the element, and emits `WHITEBOARD_UPDATE`.

Uses `isUpdatingRef` as a guard to prevent re-emitting changes received from the server. `emitThrottled` enforces a minimum interval of `TIMING.MOVEMENT_TIMEOUT` (50ms) between socket emissions.

### useWhiteboardSync

**File:** `client/src/hooks/useWhiteboardSync.ts`

Synchronizes canvas state with the server over Socket.IO. Receives full workspace state on connection, applies incremental updates, handles element deletion, and tracks active user count.

**Returns:**

```ts
interface UseWhiteboardSyncReturn {
  isConnected: boolean;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  activeUsers: number;
}
```

Listens for socket events: `connect`, `disconnect`, `WORKSPACE_STATE`, `WHITEBOARD_UPDATE`, `WHITEBOARD_CLEAR`, `DELETE_ELEMENT`, `USER_JOINED`, `USER_LEFT`.

On `WORKSPACE_STATE`: clears the canvas, then recreates all regular elements and loads diagrams. Sets object selectability based on write permission.

On `WHITEBOARD_UPDATE`: applies incremental updates. For existing objects, patches changed properties. For new objects, creates them via `createFabricObject`. Removes any temporary remote drawing objects (matched by `_shapeId` or `_drawingId`) before adding the final version.

On `DELETE_ELEMENT`: removes the object from canvas, the internal object map, and the elements map.

Maintains an internal `objectMapRef` (Map of element ID to Fabric object) for fast lookups during sync.

### useWhiteboardElements

**File:** `client/src/hooks/useWhiteboardElements.ts`

Manages the element state array and provides CRUD operations for whiteboard elements.

**Returns:**

```ts
interface UseWhiteboardElementsReturn {
  elements: Element[];
  setElements: Dispatch<SetStateAction<Element[]>>;
  createFabricObject: (element: Element) => FabricObject | null;
  addElement: (...) => void;
  updateElement: (...) => void;
  deleteElement: (...) => void;
  clearElements: (...) => void;
}
```

`createFabricObject` handles types: `path`, `text`, `rect`, `circle`, `ellipse`, `triangle`, `star`, `diamond`, `pentagon`, `hexagon`, `octagon`, `cross`, `polygon`, `line`, `arrow`, and `diagram`. Diagram type returns `null` synchronously because diagrams are loaded asynchronously via `loadDiagramToCanvas`.

### useWhiteboardTools

**File:** `client/src/hooks/useWhiteboardTools.ts`

Manages the active tool, selected shape, drawing color, brush width, and font size. Synchronizes these values with the Fabric canvas state (drawing mode, object selectability, cursor behavior).

An effect runs whenever `tool`, `isLoading`, `isConnected`, or `canWrite` changes. It toggles `canvas.isDrawingMode` when tool is `PEN`. It iterates all canvas objects to set `selectable`, `hasControls`, `hasBorders`, `evented`, and lock properties based on whether the user can draw and whether the tool supports selection.

If the user loses write permission while a drawing tool is selected, the hook resets to `TOOLS.SELECT`.

### useCanvasPanning

**File:** `client/src/hooks/useCanvasPanning.ts`

Handles canvas panning (via Space + drag, middle mouse button, or right mouse button) and zoom (mouse wheel).

**Returns:** `{ isPanningRef, isSpacePressedRef }`

Key behavior:
- Space key held: cursor becomes `grab`, enables panning.
- On mouse down with Space/middle/right button: starts panning, sets cursor to `grabbing`.
- On mouse move during panning: applies delta to `viewportTransform[4]` (x) and `viewportTransform[5]` (y).
- On mouse wheel: zoom with `ZOOM.WHEEL_OUT_MULTIPLIER` (0.95) or `ZOOM.WHEEL_IN_MULTIPLIER` (1.05), clamped between `ZOOM.MIN` (0.1) and `ZOOM.MAX` (3). Zooms to the cursor point.
- Suppresses context menu on the canvas.

## 7.2 Drawing Hooks

### useDrawingStream

**File:** `client/src/hooks/useDrawingStream.ts`

Streams freehand drawing points to the server in real time during pen tool usage. Sends only new (unsent) points from the PencilBrush's internal `_points` array.

**Returns:** `{ setupDrawingStreamHandlers: (canvas: Canvas) => () => void }`

On mouse down (left button only, drawing mode active, write permission granted): generates a new `drawingId` (UUID), emits `DRAWING_START`. On mouse move: emits `DRAWING_STREAM` throttled by `TIMING.DRAWING_STREAM_THROTTLE` (50ms). On mouse up: flushes remaining points, emits `DRAWING_END`.

### useShapeDrawing

**File:** `client/src/hooks/useShapeDrawing.ts`

Handles interactive drawing of geometric shapes (rectangle, circle, ellipse, triangle, star, diamond, pentagon, hexagon, octagon, cross) on the canvas with real-time remote broadcasting.

**Returns:**

```ts
interface UseShapeDrawingReturn {
  isDrawing: MutableRefObject<boolean>;
  startShape: (pointer: Point) => void;
  updateShape: (pointer: Point, isCtrlPressed?: boolean) => void;
  finishShape: () => void;
  cancelShape: () => void;
}
```

`startShape`: creates a shape via `createShape` from `shapeFactory`, emits `SHAPE_DRAWING_START`. `updateShape`: calls `calculateShapeUpdate` from `shapeGeometry`, emits `SHAPE_DRAWING_UPDATE` (throttled). `finishShape`: makes the shape selectable, serializes it, calls `addElement`, emits `SHAPE_DRAWING_END`.

### useLineDrawing

**File:** `client/src/hooks/useLineDrawing.ts`

Handles line and arrow drawing. Supports shift-key snapping to horizontal, vertical, or 45-degree angles.

Creates either a `Line` or an `Arrow` object depending on the active tool. For arrows, sets `headLength` to `max(width * ARROW.HEAD_LENGTH_MULTIPLIER, ARROW.MIN_HEAD_LENGTH)`.

Shift-key snapping: if `absX > absY * 2`, snaps horizontal; if `absY > absX * 2`, snaps vertical; otherwise snaps to 45 degrees.

### useTextEditing

**File:** `client/src/hooks/useTextEditing.ts`

Creates editable text objects on the canvas at a given position and immediately enters editing mode.

**Returns:** `{ addText: (position: Position) => void }`

Creates an `IText` with empty content, scaled font size (`fontSize / currentZoom`), the specified color, and `CANVAS.DEFAULT_FONT_FAMILY` ("Inter"). Calls `enterEditing()` and focuses the hidden textarea for immediate typing.

## 7.3 Remote Sync Hooks

### useRemoteDrawing

**File:** `client/src/hooks/useRemoteDrawing.ts`

Orchestrates remote drawing by composing `useRemotePathDrawing` and `useRemoteShapeDrawing`. Listens for six socket events: `DRAWING_START`, `DRAWING_STREAM`, `DRAWING_END`, `SHAPE_DRAWING_START`, `SHAPE_DRAWING_UPDATE`, `SHAPE_DRAWING_END`.

Maintains a shared `activeDrawingsRef` (Map of drawing/shape ID to `DrawingData`) and `cleanupTimeoutsRef`.

### useRemotePathDrawing

**File:** `client/src/hooks/useRemotePathDrawing.ts`

Renders freehand paths drawn by remote users in real time. Converts streamed point arrays to SVG path strings and updates a Fabric `Path` object on the canvas.

`handleDrawingStream`: accumulates points, converts them to an SVG path string using `pointsToSvgPath` (quadratic bezier curves through midpoints). Creates a non-selectable `Path` with `_isRemoteDrawing = true`.

`handleDrawingEnd`: sets a hardcoded 100ms timeout (not using the `TIMING.REMOTE_DRAWING_CLEANUP_DELAY` constant) to remove the temporary path. The delay prevents flickering when the server's final committed version arrives shortly after.

### useRemoteShapeDrawing

**File:** `client/src/hooks/useRemoteShapeDrawing.ts`

Renders geometric shapes drawn by remote users in real time.

`handleShapeDrawingStart`: creates the appropriate Fabric object based on `shapeType`. All remote shapes are non-selectable, non-evented, with `_isRemoteShape = true`.

`handleShapeDrawingEnd`: sets a timeout of `TIMING.REMOTE_DRAWING_CLEANUP_DELAY` (100ms) to remove the temporary shape.

### useCursorSync

**File:** `client/src/hooks/useCursorSync.ts`

Tracks and broadcasts cursor positions for multi-user collaboration. Assigns each user a random color and animal name for identification.

**Returns:**

```ts
interface UseCursorSyncReturn {
  remoteCursors: RemoteCursors;
  emitCursorPosition: (x: number, y: number) => void;
  userInfo: UserInfo | null;
}
```

On socket init: assigns a random color from `CURSOR_COLORS` and a random animal from `CURSOR_ANIMALS`. Listens for `CURSOR_UPDATE` events: updates `remoteCursors` state. Sets a timeout of `TIMING.CURSOR_TIMEOUT` (5000ms) to remove stale cursors. `emitCursorPosition` is throttled to `TIMING.CURSOR_THROTTLE` (50ms).

## 7.4 Integration Hooks

### useCodeToCanvas

**File:** `client/src/hooks/useCodeToCanvas.ts`

Returns a callback that places code content as an `IText` object on the canvas, centered in the current viewport. Font size is `14 / currentZoom`. Uses `CANVAS.CODE_FONT_FAMILY` ("Consolas, Monaco, monospace").

### useDiagramToCanvas

**File:** `client/src/hooks/useDiagramToCanvas.ts`

Returns an async callback that renders Mermaid diagram markup to SVG, converts it to a PNG, and places it on the canvas as an image element.

Steps:
1. Lazy-loads Mermaid via `loadMermaid` with `securityLevel: 'loose'`.
2. Processes SVG through `processSvgForTransparency`.
3. Renders to `Image`, draws onto a temporary `<canvas>` at 2x scale.
4. Converts to PNG data URL and creates a `DiagramElementData`.

### useSharingSocketHandlers

**File:** `client/src/hooks/useSharingSocketHandlers.ts`

Handles socket events related to sharing permissions: `SHARING_INFO`, `EDIT_TOKEN_UPDATED`, and `SHARING_MODE_CHANGED`.

On `SHARING_INFO`: sets sharing mode, allowed users, edit access, owner, and current user. Marks `sharingInfoReceived = true`. On `SHARING_MODE_CHANGED`: updates the mode. On `EDIT_TOKEN_UPDATED`: stores the new edit token.

## 7.5 Utility Hooks

### useClickOutside

**File:** `client/src/hooks/useClickOutside.ts`

Calls a callback when a `mousedown` event occurs outside the referenced element. Can be activated or deactivated via the `isActive` parameter.

Also exports:

- **`useEscapeKey`**: calls a callback when the Escape key is pressed.
- **`useDropdownBehavior`**: combines `useClickOutside` and `useEscapeKey` to close a dropdown.

### useKeyboardDelete

**File:** `client/src/hooks/useKeyboardDelete.ts`

Deletes selected canvas objects when the Delete key is pressed while the select tool is active. For each active object with an `id`: clears any pending modification timeout, removes the object from canvas, and emits `DELETE_ELEMENT`.

### useObjectModification

**File:** `client/src/hooks/useObjectModification.ts`

Tracks object modification events (move, scale, rotate) on the canvas and persists changes by calling `updateElement` after a debounce timeout.

Listens for `object:modified`, `object:moving`, `object:scaling`, `object:rotating`. Debounces the update via `TIMING.MOVEMENT_TIMEOUT` (50ms). The `updateElementByType` helper builds the correct element data structure based on object type.

## 7.6 Remote Drawing Types

**File:** `client/src/hooks/remoteDrawingTypes.ts`

```ts
interface DrawingData {
  fabricPath: (Path & { _isRemoteDrawing?: boolean; _drawingId?: string }) | null;
  fabricShape?: (FabricObject & { _isRemoteShape?: boolean; _shapeId?: string }) | null;
  points: Point[];
  color: string;
  brushWidth: number;
  userId?: string;
  shapeType?: string;
  interpolator?: PerfectCursor;
}
```

---

# 8. Frontend Utilities

## 8.1 batchedRender.ts

Coalesces multiple `requestRenderAll` calls on a Fabric canvas into a single call per animation frame.

```ts
function createBatchedRender(canvas: FabricCanvas | null): () => void
function cancelBatchedRender(canvas: FabricCanvas): void
```

Uses a `WeakMap<FabricCanvas, RenderQueue>` to store per-canvas render queue state.

## 8.2 canvasExport.ts

Exports the visible canvas area as a PNG data URL.

```ts
function getFullCanvasImage(canvas: Canvas | null): CanvasImageData | null
```

Computes the visible viewport area from the canvas transform matrix. Calls `canvas.toDataURL` with `CANVAS.EXPORT_MULTIPLIER` (2x) for retina output. Calculates `objectsBounds` by scanning all objects' corner coordinates, adding `CANVAS.EXPORT_PADDING` (50px).

## 8.3 fabricArrow.ts

Defines a custom Fabric.js `Arrow` class that extends `Line` with arrowhead rendering.

```ts
class Arrow extends Line {
  headLength: number;   // default ARROW.HEAD_LENGTH (15)
  headAngle: number;    // default ARROW.HEAD_ANGLE (PI/6)
}
```

`_render` draws the line segment, then two arrowhead lines from the endpoint at `+/-headAngle` from the line angle. Registered in the Fabric class registry under both `'Arrow'` and `'arrow'`.

## 8.4 fabricHelpers.ts

```ts
function getAbsolutePosition(item: FabricObject, group: Group): { left: number; top: number }
```

Computes the absolute canvas position of an object inside a group by applying the group's transform matrix via `util.transformPoint`.

## 8.5 index.ts (utils barrel)

| Function | Description |
|---|---|
| `getWorkspaceId(): string \| null` | Extracts workspace ID from URL path (`/.../{id}`) |
| `generateUserId(): string` | Creates `user-{timestamp}-{random6chars}` |
| `getPersistentUserId(): string` | Gets or creates a user ID from localStorage |
| `getAccessToken(workspaceId): string \| null` | Reads access token from localStorage |
| `setAccessToken(workspaceId, token): void` | Stores access token |
| `removeAccessToken(workspaceId): void` | Removes access token |
| `constrainObjectToBounds(obj, canvas, buffer?): boolean` | Clamps a Fabric object's position within the visible viewport |

## 8.6 mermaid.ts

```ts
const loadMermaid: (config?: MermaidConfig) => Promise<MermaidModule['default']>
```

Lazy-loads the Mermaid library via dynamic `import('mermaid')`. Caches the import promise so the library is loaded only once.

## 8.7 sessionToken.ts

Stores tokens in `sessionStorage` with an expiration timestamp. `TOKEN_TTL_MS` is 4 hours.

```ts
function setSessionToken(key: string, value: string | undefined): void
function getSessionToken(key: string): string | null
```

Returns `null` and removes the entry if expired or malformed.

## 8.8 shapeGeometry.ts

Calculates shape dimensions and point arrays during interactive drawing.

```ts
function calculateShapeUpdate(shapeType: string, params: ShapeUpdateParams): ShapeUpdateResult | null
```

Uses a lookup table (`shapeCalculators`) indexed by shape type. Each calculator returns either `props` (for rect, circle, ellipse) or `points` (for triangle, star, diamond, pentagon, hexagon, octagon, cross).

Shape-specific behavior:
- **rectangle**: Ctrl held forces a square. Handles negative drag direction.
- **circle**: radius = `sqrt(dx^2 + dy^2) / 2`. Centered on start point.
- **ellipse**: `rx = |dx| / 2`, `ry = |dy| / 2`.
- **triangle**: supports upside-down drawing. Ctrl forces equal width and height (isosceles).
- **star**: 10 points, alternating outer and inner radius (`outer * 0.4`).
- **diamond**: 4 points arranged as a rotated square.
- **pentagon/hexagon/octagon**: uses `createRegularPolygon(sides, center, radius)`.
- **cross**: 12-point polygon forming a plus shape. Arm width = `size / 3`.

## 8.9 toast.ts

Wraps `react-toastify` with a maximum toast limit.

Tracks active toasts in a `Set<Id>`. Before showing a new toast, dismisses the oldest if the count would exceed `TOAST.MAX_TOASTS` (3). If a custom `toastId` is provided and already active, returns it without creating a duplicate.

---

# 9. Frontend Factories

## 9.1 shapeFactory.ts

**File:** `client/src/factories/shapeFactory.ts`

Creates Fabric.js shape objects for both initial drawing (empty shapes) and reconstruction from data.

```ts
function createShape(shapeType: string, props: ShapeProps): FabricObject | null
```

Creates a new, empty shape for interactive drawing. Shape type lookup:
- `rectangle` -> `new Rect({ width: 0, height: 0, ... })`
- `circle` -> `new Circle({ radius: 0, ... })`
- `ellipse` -> `new Ellipse({ rx: 0, ry: 0, ... })`
- `triangle`, `star`, `diamond`, `pentagon`, `hexagon`, `octagon`, `cross` -> `new Polygon(initialPoints, ...)`

```ts
function createShapeFromData(type: string, data: ShapeProps): FabricObject | null
```

Recreates a shape from serialized data (e.g., received from the server).

```ts
function isPolygonShape(shapeType: string): boolean
const POLYGON_SHAPES: string[]  // triangle, star, diamond, pentagon, hexagon, octagon, cross
```

## 9.2 diagramFactory.ts

**File:** `client/src/factories/diagramFactory.ts`

```ts
async function loadDiagramToCanvas(canvas: Canvas, element: DiagramElement, isSelectable?: boolean): Promise<void>
```

Checks if the element already exists on the canvas by ID (prevents duplicates). Loads the image via `FabricImage.fromURL` with `crossOrigin: 'anonymous'`. Sets position, scale, angle, selectability, and styling.

---

# 10. Frontend Types, Constants, i18n

## 10.1 Type Definitions (sharing.ts)

**File:** `client/src/types/sharing.ts`

```ts
type SharingModeType = typeof SHARING_MODES[keyof typeof SHARING_MODES];

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

Socket event payload types: `SharingInfoData`, `SharingModeChangedData`, `EditTokenUpdateData`, `WorkspaceExistsData`.

## 10.2 Constants

**File:** `client/src/constants/index.ts`

Imports `SOCKET_EVENTS` and `SHARING_MODES` from `shared/constants.js`.

### Tool and Shape Types

| Constant | Values |
|---|---|
| `TOOLS` | `select`, `pen`, `text`, `shapes`, `line`, `arrow` |
| `SHAPES` | `rectangle`, `circle`, `ellipse`, `triangle`, `pentagon`, `hexagon`, `octagon`, `diamond`, `star`, `cross` |

### Zoom

| Key | Value |
|---|---|
| `ZOOM.WHEEL_OUT_MULTIPLIER` | 0.95 |
| `ZOOM.WHEEL_IN_MULTIPLIER` | 1.05 |
| `ZOOM.MIN` | 0.1 |
| `ZOOM.MAX` | 3 |
| `ZOOM.BUTTON_INCREMENT` | 0.1 |

### Timing

| Key | Value | Purpose |
|---|---|---|
| `DEBOUNCE_DELAY` | 250ms | General debounce |
| `MOVEMENT_TIMEOUT` | 50ms | Object modification debounce |
| `CURSOR_THROTTLE` | 50ms | Cursor position emit throttle |
| `CURSOR_TIMEOUT` | 5000ms | Remote cursor removal timeout |
| `DRAWING_STREAM_THROTTLE` | 50ms | Drawing point stream throttle |
| `TOKEN_TTL_MS` | 14400000 (4h) | Session token TTL |
| `REMOTE_DRAWING_CLEANUP_DELAY` | 100ms | Delay before removing temp remote drawing |
| `SOCKET_TIMEOUT` | 20000ms | Socket connection timeout |
| `RECONNECT_DELAY` | 2000ms | Base reconnect delay |
| `RECONNECT_MAX_DELAY` | 10000ms | Max reconnect delay |

### Canvas Settings

| Key | Value |
|---|---|
| `CANVAS.DEFAULT_FONT_SIZE` | 20 |
| `CANVAS.DEFAULT_FONT_FAMILY` | `'Inter'` |
| `CANVAS.CODE_FONT_FAMILY` | `'Consolas, Monaco, monospace'` |
| `CANVAS.DEFAULT_BRUSH_WIDTH` | 2 |
| `CANVAS.EXPORT_MULTIPLIER` | 2 |
| `CANVAS.EXPORT_PADDING` | 50 |
| `CANVAS.EDGE_BUFFER` | 40 |

### Colors

- `BRUSH_COLORS`: 24 preset brush colors.
- `CURSOR_COLORS`: 10 color objects for remote cursor display.
- `CURSOR_ANIMALS`: 20 animal name keys used as anonymous user identifiers.
- `MERMAID_THEME`: Mermaid diagram theme variables.

### Storage Keys

| Key | Storage |
|---|---|
| `USER_ID` | `'shareboardUserId'` in localStorage |
| `LANGUAGE` | `'shareboardLanguage'` in localStorage |
| `SPLIT_POSITION` | `'shareboardSplitPosition'` in localStorage |

### Other

- `GRID`: size 20, color `rgba(200, 200, 200, 0.3)`.
- `FONT_SIZES`: `[12, 16, 20, 24, 32, 40, 48, 64, 80]`.
- `LAYOUT`: min/max width percentages (30/70).
- `TOAST`: max 3 simultaneous toasts, positioned bottom-right.
- `SOCKET`: max 5 reconnect attempts.
- `CODE_EDITOR_LANGUAGES`: 10 supported languages with example code snippets.

### Additional Constants

| Constant Group | Description |
|---|---|
| `FABRIC_TYPES` | 19 Fabric.js type identifiers (LINE, ARROW, RECT, CIRCLE, ELLIPSE, TRIANGLE, TEXT, I_TEXT, PATH, POLYGON, IMAGE, DIAGRAM, GROUP, STAR, DIAMOND, PENTAGON, HEXAGON, OCTAGON, CROSS) |
| `FABRIC_EVENTS` | 15 Fabric.js canvas event names (path:created, object:modified, object:moving, object:moved, object:scaling, object:rotating, text:changed, mouse:down, mouse:move, mouse:up, mouse:wheel, mouse:dblclick, selection:created, selection:updated, selection:cleared) |
| `ARROW` | Arrow rendering constants: `HEAD_LENGTH` (15), `HEAD_ANGLE` (PI/6), `MIN_HEAD_LENGTH`, `HEAD_LENGTH_MULTIPLIER` |
| `SHAPE_GEOMETRY` | Shape calculation helpers: `STAR`, `PENTAGON`, `HEXAGON`, `OCTAGON`, `CROSS`, `LINE_SNAP` sub-objects |
| `CODE_EXAMPLES` | One code example per language (10 languages: javascript, typescript, python, java, cpp, go, sql, html, css, json) |
| `SAMPLE_DIAGRAM` | Default Mermaid diagram template (`graph TD` with Start/End nodes) |
| `POLYGON_SHAPE_TYPES` | 7 polygon-based shape types |
| `INTERACTIVE_TYPES` | 18 selectable/interactive Fabric object types |
| `DEFAULT_COLORS` | 4 default color values (BLACK, SELECTION, SELECTION_BORDER, TRANSPARENT) |
| `COLORS` | 11 named color values (including `BG_WHITEBOARD`) |
| `COLOR_PICKER` | 3 color picker configuration values |
| `KEYBOARD` | 2 keyboard-related constants |
| `CONTROL_TIPS` | 5 keyboard shortcut tip strings |
| `DIAGRAM_POSITION` | 6 diagram placement properties |
| `EXPORT` | Export-related constants |
| `CONNECTION_STATUS` | 4 connection status values |
| `FABRIC_OBJECT_PROPS` | 24 default Fabric object properties |
| `MERMAID_THEME` | 17 Mermaid diagram theme CSS variables |

## 10.3 Internationalization (i18n)

**File:** `client/src/i18n/index.ts`

Uses `i18next` with `react-i18next`. Initialized synchronously with bundled translation resources. Language detection priority:

1. URL query parameter `?lang=`
2. Previously saved language in localStorage
3. Default fallback: `'cs'` (Czech)

### Supported Languages

- English (`en`)
- Czech (`cs`) (default)

### Translation Namespaces

| Namespace | Description |
|---|---|
| `common` | Buttons, status messages, accessibility labels, animal names |
| `landing` | Landing page content |
| `workspace` | Workspace-related UI strings |
| `sharing` | Sharing dialog and permission strings |
| `toolbar` | Tool labels, shape names, options, control tips |
| `editor` | Code editor UI strings |
| `messages` | Toast messages and notifications |
| `validation` | Form validation messages |

---

# 11. Backend Server

## 11.1 Entry Point (server/index.ts)

The server starts by creating an Express application and wrapping it with Node's `http.createServer`. A Socket.IO server is attached to the HTTP server with CORS and transport settings from `config`.

A separate `WebSocketServer` (from the `ws` library) is created with `{ noServer: true }`. It handles Yjs real-time document synchronization. The HTTP server's `upgrade` event is intercepted: if the requested pathname is `/yjs` or starts with `/yjs/`, the upgrade is forwarded to the Yjs WebSocket server. All other upgrades fall through to Socket.IO's default handling.

On startup, `batchService.startBatchInterval(io)` begins a periodic flush of queued whiteboard updates. A cleanup interval runs every `config.cleanup.intervalMs` (5 minutes) to remove inactive workspaces and their batch queues.

**Middleware chain (in order):**

1. `helmet()` with a custom Content-Security-Policy. CSP allows scripts from `cdn.jsdelivr.net`, styles from Google Fonts and jsDelivr, fonts from `data:`, Google Fonts, and jsDelivr, images from `data:` and `blob:`, WebSocket connections, and blob workers. `crossOriginEmbedderPolicy` is disabled.
2. `cors()` with origins from config.
3. `express.json()` for body parsing.

**HTTP routes:**

| Route | Method | Rate Limiter | Description |
|---|---|---|---|
| `/` | GET | none | Serves `index.html` from `dist/` (production) or `client/` (development) |
| `/api/workspaces` | POST | `createWorkspaceLimiter` (10 req/min) | Creates a new workspace. Returns `{ workspaceId }` |
| `/w/:workspaceId` | GET | none | Serves `index.html` (SPA routing for workspace URLs) |
| `/api/workspace/:workspaceId` | GET | `apiLimiter` (100 req/min) | Checks if workspace exists. Returns `{ exists: true }` or 404 |

**Static files:** In production, served from `../dist`. In development, served from `../client`.

**Socket.IO connection handler:** On each new connection, a `currentWorkspaceRef` and `currentUser` are initialized. Each socket event is wired to the corresponding handler, with rate limiting applied via `checkRateLimit` for most write events.

**Error handlers:** The server registers `process.on('uncaughtException')`, `process.on('unhandledRejection')`, and `io.on('error')` handlers. All three log the error to `console.error`.

**Graceful shutdown:** Handlers for `SIGTERM` and `SIGINT` clear the rate limit cleanup interval and close the HTTP server.

### Inline Socket Events in index.ts

Several events are handled directly in `server/index.ts`:

- `check-workspace-exists`: Emits `workspace-exists-result` with `{ workspaceId, exists }`.
- `get-sharing-info`: Calculates edit access, validates token, emits `sharing-info`.
- `get-active-users`: Emits `active-users-update` with user array.
- `cursor-position`: Validates fields, broadcasts `cursor-update` to others in the room.
- `drawing-start`, `drawing-stream`, `drawing-end`: Validates drawing data, checks write permission, broadcasts to room.
- `shape-drawing-start`, `shape-drawing-update`, `shape-drawing-end`: Validates shape data, checks write permission, broadcasts to room.

## 11.2 Configuration (server/config.ts)

Re-exports `SOCKET_EVENTS` and `SHARING_MODES` from `shared/constants`, then defines a `config` object.

| Path | Default Value | Description |
|---|---|---|
| `port` | `process.env.PORT \|\| 3000` | Server listen port |
| `isProduction` | `process.env.NODE_ENV === 'production'` | Production flag |
| `cors.origin` | Production: shareboard.live domains; Dev: localhost:5173, localhost:3000 | Allowed CORS origins |
| `socketIO.transports` | `['websocket', 'polling']` | Transport order |
| `socketIO.pingInterval` | 25000 (25s) | Ping interval |
| `socketIO.pingTimeout` | 60000 (60s) | Ping timeout |
| `socketIO.maxHttpBufferSize` | 1e6 (1 MB) | Max HTTP long-polling buffer |
| `cleanup.intervalMs` | 300000 (5 min) | Workspace cleanup frequency |
| `cleanup.inactiveThresholdMs` | 900000 (15 min) | Inactive workspace threshold |
| `workspace.keyLength` | 12 | Workspace ID length |
| `workspace.userIdLength` | 10 | User ID length |
| `batch.interval` | 50 (ms) | Whiteboard batch flush interval |
| `validation.drawing.maxPointsLength` | 10000 | Max points in a drawing stream |
| `validation.element.maxIdLength` | 100 | Max element ID length |
| `validation.element.maxTextLength` | 2000 | Max text content length |
| `validation.element.maxSrcLength` | 512000 (512 KB) | Max source string length |
| `validation.workspace.maxElementsPerUpdate` | 100 | Max elements per update |
| `validation.workspace.maxCodeLength` | 500000 (500 KB) | Max code content length |
| `validation.workspace.maxDiagramLength` | 100000 (100 KB) | Max diagram content length |
| `validation.workspace.maxDrawings` | 5000 | Max drawings per workspace |
| `validation.workspace.maxUsersPerWorkspace` | 100 | Max concurrent users |
| `socketIO.perMessageDeflate` | `false` | Per-message deflate compression |
| `validation.drawing.maxIdLength` | 64 | Max drawing ID length |
| `validation.drawing.maxShapeIdLength` | 64 | Max shape ID length |
| `validation.drawing.maxShapeTypeLength` | 32 | Max shape type string length |
| `validation.drawing.minBrushWidth` | 1 | Min brush width |
| `validation.drawing.maxBrushWidth` | 100 | Max brush width |
| `validation.drawing.maxPointsLength` | 10000 | Max points in a drawing stream |
| `validation.cursor.minPosition` | 0 | Min cursor position value |
| `validation.cursor.maxPosition` | 10000 | Max cursor position value |
| `validation.cursor.maxColorLength` | 32 | Max cursor color string length |
| `validation.cursor.maxAnimalKeyLength` | 32 | Max animal key string length |
| `validation.lock.retryDelayMs` | 100 | Lock retry delay |
| `validation.lock.timeoutMs` | 5000 (5s) | Lock expiration timeout |
| `validation.rateLimit.windowMs` | 1000 (1s) | Fixed window for rate limiting |
| `validation.rateLimit.maxEventsPerWindow` | 50 | Max events per window per socket |

## 11.3 Type Definitions (server/types.ts)

**Core Types:**

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

interface WhiteboardElement {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
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

interface WorkspaceState {
  whiteboardElements: WhiteboardElement[];
  diagrams: unknown[];
  activeUsers: number;
  allDrawings: WhiteboardElement[];
  codeSnippets: CodeSnippets;
  diagramContent: string;
}
```

**Handler Types:**

```typescript
interface HandlerContext {
  socket: Socket;
  io?: Server;
  currentUser: CurrentUser;
  currentWorkspaceRef?: CurrentWorkspaceRef;
  queueUpdate?: (workspaceId: string, elements: WhiteboardElement[], senderSocketId: string) => void;
  workspace?: Workspace;
}

interface HandlerResult {
  success: boolean;
  reason?: string;
  error?: unknown;
  workspace?: Workspace;
  isNewWorkspace?: boolean;
  editToken?: string;
  userId?: string;
  disconnectedClients?: string[];
  skippedDuplicate?: boolean;
}
```

## 11.4 Socket Handlers

### workspaceHandlers.ts

**Event: `join-workspace`**

Validates workspace ID. If the socket is already in the room, re-emits join events and returns early. Calls `ensureWorkspaceExists`, which uses a locking mechanism to prevent race conditions when two clients try to create the same workspace simultaneously. Checks workspace capacity (`MAX_USERS_PER_WORKSPACE = 100`). Sets up user session, joins the socket room, emits `workspace-state`, `sharing-info`, and `user-joined`. If the workspace has active text edit locks, emits `text-edit-locks` to the joining socket.

**Event: `disconnect`**

Releases text edit locks held by the disconnecting socket. Broadcasts updated `text-edit-locks` to the room after releasing. Removes the connection and emits `user-left`.

### whiteboardHandlers.ts

All handlers wrapped with `withWorkspaceAuth` (room membership + write permission).

**`whiteboard-update`**: Validates elements array (max 100, each passes `isValidElement`). Stores elements in maps with timestamps. Tracks insertion order. Evicts oldest when exceeding `MAX_DRAWINGS` (5000). Queues for batched emission.

**`whiteboard-clear`**: Clears all maps and broadcasts.

**`delete-element`**: Removes element and broadcasts.

### textEditHandlers.ts

**`text-edit-start`**: Cleans up expired locks (timeout: `config.validation.lock.timeoutMs`, default 5000ms). If element is already locked by another socket, denies the request. Otherwise sets a lock with `{ userId, socketId, timestamp }`. Broadcasts updated locks.

**`text-edit-end`**: Removes the lock only if the requesting socket holds it. Broadcasts.

### editorHandlers.ts

**`code-update`**: Validates content (max 500,000 chars) and language (max 32 chars). Updates workspace, broadcasts.

### sharingHandlers.ts

**`get-edit-token`**: Owner-only. Returns token via callback.

**`set-edit-token`**: Owner-only. Token must start with `edit_` and have length >= 13.

**`change-sharing-mode`**: Owner-only. Validates mode against `SHARING_MODES`. Broadcasts `sharing-mode-changed`.

**`end-session`**: Owner-only. Emits `session-ended` and disconnects all other clients.

### elementValidation.ts

- `WORKSPACE_ID_REGEX`: `/^[a-zA-Z0-9_-]{1,32}$/`
- `ELEMENT_TYPES`: Set of 16 types (rect, circle, ellipse, triangle, line, arrow, path, text, diagram, polygon, star, diamond, pentagon, hexagon, octagon, cross)
- `isValidElement(element)`: validates id, type, and data properties

## 11.5 Services

### workspaceService.ts

Manages all workspace data in memory. Three top-level Maps:

- `workspaces: Map<string, Workspace>`
- `activeConnections: Map<string, Set<string>>`
- `userSessions: Map<string, UserSession>`

Key methods:

| Method | Description |
|---|---|
| `generateKey(length?)` | URL-safe random string via `crypto.randomBytes` |
| `generateEditToken()` | Returns `edit_` + 64 hex characters |
| `createWorkspace(id, ownerId)` | Creates workspace with defaults, `read-write-all` mode |
| `getWorkspace(id)` | Returns workspace or undefined |
| `workspaceExists(id)` | Returns boolean |
| `deleteWorkspace(id)` | Removes workspace, connections, and Yjs document |
| `updateLastActivity(workspaceId)` | Updates the `lastActivity` timestamp |
| `getActiveConnections(workspaceId)` | Returns the `Set<string>` of socket IDs |
| `addConnection(workspaceId, socketId)` | Returns new connection count |
| `removeConnection(workspaceId, socketId)` | Returns remaining count |
| `getActiveUserCount(workspaceId)` | Deduplicates by userId |
| `setUserSession(socketId, userInfo)` | Stores a user session |
| `getUserSession(socketId)` | Returns session or undefined |
| `removeUserSession(socketId)` | Deletes the session entry |
| `getWorkspaceUsers(workspaceId)` | Returns `WorkspaceUser[]` with owner flag |
| `releaseTextLocksForSocket(workspaceId, socketId)` | Removes locks held by socket |
| `cleanupInactiveWorkspaces()` | Deletes workspaces with 0 connections older than 15 min |
| `getWorkspaceState(workspaceId)` | Full state snapshot |
| `findWorkspaceIdByRef(workspaceRef)` | Extracts workspace ID from a ref object |
| `updateSharingMode(workspaceId, mode)` | Validates and updates mode |

### permissionService.ts

Handles permission checks. No persistent state.

| Method | Description |
|---|---|
| `checkWritePermission(workspace, user)` | Returns true if owner, or mode allows, or token matches |
| `checkOwnership(workspace, userId)` | Returns true if user is owner |
| `calculateEditAccess(workspace, user, token?)` | Returns `{ hasEditAccess, isOwner }` |
| `validateAndSetToken(workspace, token, user?)` | Sets `user.hasEditAccess = true` if token matches |
| `getSharingInfo(workspace, user?)` | Returns sharing config (editToken only for owner) |

### batchService.ts

Batches whiteboard element updates to reduce emission frequency.

Storage: `updateQueues: Map<string, UpdateQueue>` where `UpdateQueue` has an `elements` map and a `senders` set.

`startBatchInterval(io)` runs every 50ms. For each workspace queue with elements, collects all queued elements, clears the queue, then emits `whiteboard-update` to each socket except senders.

### rateLimitService.ts

Per-socket, per-event rate limiting using a fixed (tumbling) window of 1 second, allowing up to 50 events per window. The window resets entirely when the period expires (not a sliding window).

`startCleanupInterval()` runs every 30 seconds, removing stale entries.

## 11.6 Middleware (socketAuth.ts)

Three higher-order functions that wrap handler functions:

**`withWorkspaceAuth`**: Checks room membership, workspace existence, and write permission (via `permissionService.checkWritePermission`).

**`withRoomAuth`**: Lighter check: only room membership and workspace existence. No write permission check. Used for `text-edit-end`.

**`withOwnerAuth`**: Checks workspace existence and ownership.

## 11.7 Validation

### schemas.ts (Zod)

- `WorkspaceIdSchema`: `z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/)`
- `WhiteboardElementSchema`: id (1-100 chars), type (15 shape types in Zod enum, note: `ellipse` is missing from the Zod schema but present in `elementValidation.ts` which has 16 types), data (strict object with optional numeric/string fields)
- `WhiteboardUpdateSchema`: workspaceId + elements array (max 100)
- `CursorPositionSchema`: position with x/y ranges (-10000 to 100000), optional hex color, optional animalKey
- `DrawingStreamSchema`: drawingId (1-100 chars) + points array (max 100)

### validators.ts (manual)

Runtime validation functions for socket event handlers:

| Function | Validates |
|---|---|
| `isValidCursorPosition` | Finite x/y within [0, 10000] |
| `isValidUserColor` | String, max 32 chars |
| `isValidDrawingId` | Non-empty string, max 64 chars |
| `isValidShapeId` | Non-empty string, max 64 chars |
| `isValidColor` | Hex, rgb(), rgba(), or named CSS color |
| `isValidBrushWidth` | Number in [1, 100] |
| `isValidPoints` | Array of numbers or {x, y} objects, max 10000 |
| `isValidShapeData` | Object with valid numeric properties |
| `isValidAnimalKey` | Non-empty string, max 32 chars |
| `isValidShapeType` | Non-empty string, max 32 chars |

## 11.8 Utilities

### securityUtils.ts

```ts
safeCompareTokens(a: string | null | undefined, b: string | null | undefined): boolean
```

Timing-safe token comparison using `crypto.timingSafeEqual`. Returns false if either value is falsy or lengths differ. Prevents timing attacks when comparing edit tokens.

### userUtils.ts

```ts
toUser(currentUser: CurrentUser): User
```

Converts a `CurrentUser` (mutable per-socket object) to a `User` (permission-check interface).

## 11.9 Yjs Utilities (server/yjs-utils.ts)

Replaces the default `y-websocket/bin/utils` to avoid deprecated `level-*` dependencies. Provides a minimal Yjs WebSocket synchronization server.

**`WSSharedDoc`** extends `Y.Doc`. Tracks connections, awareness, and handles updates.

**Persistence:** `schedulePersist` debounces writes (250ms). Reads Yjs `code` and `diagram` text types and writes them to the workspace's `codeSnippets.content` and `diagramContent`.

**Rate limiting:** Max 10 connections per IP per 60-second window. Exceeding the limit closes the WebSocket with code `4429`.

**`setupWSConnection(conn, req, options?)`:** Extracts workspace ID from URL path. Validates workspace exists (closes with `4404` if not). Gets or creates the `WSSharedDoc`. Sets up message, close, and pong listeners. Starts a ping interval (30 seconds). Sends `SyncStep1` to begin sync.

**`cleanupYjsDoc(workspaceId)`:** Closes all connections and removes the document from memory.

---

# 12. Shared Code

## 12.1 Constants (shared/constants.ts)

Imported by both server and client code.

**`SOCKET_EVENTS`**: A frozen object mapping event name constants to their string values. All socket communication uses these constants instead of raw strings.

| Constant | Value |
|---|---|
| `CONNECTION` | `'connection'` |
| `CONNECT` | `'connect'` |
| `DISCONNECT` | `'disconnect'` |
| `ERROR` | `'error'` |
| `CHECK_WORKSPACE_EXISTS` | `'check-workspace-exists'` |
| `WORKSPACE_EXISTS_RESULT` | `'workspace-exists-result'` |
| `JOIN_WORKSPACE` | `'join-workspace'` |
| `USER_JOINED` | `'user-joined'` |
| `USER_LEFT` | `'user-left'` |
| `WORKSPACE_STATE` | `'workspace-state'` |
| `WHITEBOARD_UPDATE` | `'whiteboard-update'` |
| `WHITEBOARD_CLEAR` | `'whiteboard-clear'` |
| `DELETE_ELEMENT` | `'delete-element'` |
| `DRAWING_START` | `'drawing-start'` |
| `DRAWING_STREAM` | `'drawing-stream'` |
| `DRAWING_END` | `'drawing-end'` |
| `SHAPE_DRAWING_START` | `'shape-drawing-start'` |
| `SHAPE_DRAWING_UPDATE` | `'shape-drawing-update'` |
| `SHAPE_DRAWING_END` | `'shape-drawing-end'` |
| `CODE_UPDATE` | `'code-update'` |
| `GET_SHARING_INFO` | `'get-sharing-info'` |
| `SHARING_INFO` | `'sharing-info'` |
| `SHARING_UPDATE` | `'sharing-update'` |
| `GET_ACTIVE_USERS` | `'get-active-users'` |
| `ACTIVE_USERS_UPDATE` | `'active-users-update'` |
| `CURSOR_POSITION` | `'cursor-position'` |
| `CURSOR_UPDATE` | `'cursor-update'` |
| `TEXT_EDIT_START` | `'text-edit-start'` |
| `TEXT_EDIT_END` | `'text-edit-end'` |
| `TEXT_EDIT_LOCKS` | `'text-edit-locks'` |
| `GET_EDIT_TOKEN` | `'get-edit-token'` |
| `SET_EDIT_TOKEN` | `'set-edit-token'` |
| `EDIT_TOKEN_UPDATED` | `'edit-token-updated'` |
| `END_SESSION` | `'end-session'` |
| `SESSION_ENDED` | `'session-ended'` |
| `CHANGE_SHARING_MODE` | `'change-sharing-mode'` |
| `SHARING_MODE_CHANGED` | `'sharing-mode-changed'` |

**`SHARING_MODES`**: Three modes:

| Constant | Value | Behavior |
|---|---|---|
| `READ_WRITE_ALL` | `'read-write-all'` | All users can edit |
| `READ_ONLY` | `'read-only'` | Only the owner can edit |
| `READ_WRITE_SELECTED` | `'read-write-selected'` | Owner and users with valid edit token can edit |

---

# 13. Testing

## 13.1 Test Setup

Tests are configured in `vitest.config.js`. The runner uses Vitest 4.x with `globals: true`, `environment: 'node'`, and a setup file at `tests/setup.js`.

Coverage uses the V8 provider and reports as text + HTML. Coverage is collected for server services, client utilities, and client hooks.

The setup file (`tests/setup.js`) does three things:
1. Mocks `crypto.randomBytes` to return a deterministic buffer (filled with `'a'`).
2. Mocks `localStorage` with an in-memory store object.
3. Mocks `window.location` with a default pathname of `/w/test-workspace-id`.

## 13.2 Client Tests

### fabricArrow.test.ts

Tests the custom Fabric.js `Arrow` class extending `Line`. The entire `fabric` module is mocked. Tests cover:
- Initialization with defaults and custom options
- `_render` method context calls and arrowhead geometry
- `toObject` / `fromObject` serialization round-trip
- Class registry registration

### geometry.test.ts

Tests geometry calculation algorithms (re-implemented inline because they are embedded in the hook). Covers:
- Rectangle dimensions in all drag directions, Ctrl modifier for square
- Circle radius and position from horizontal/diagonal drags
- Triangle points with upside-down detection, Ctrl for equilateral
- Line snap logic: horizontal, vertical, 45-degree diagonal with Shift key

### sessionToken.test.ts

Tests `setSessionToken` and `getSessionToken`. Covers:
- Token storage with expiration timestamp
- Skipping undefined/empty values
- Valid token retrieval before expiration
- Expired token cleanup
- Malformed JSON handling
- Missing/null values

### utils.test.ts

Tests the utils barrel export. Covers:
- `getWorkspaceId`: URL path extraction
- `generateUserId`: format and uniqueness
- `constrainObjectToBounds`: boundary clamping with custom buffer
- Persistent user ID and access token localStorage helpers

## 13.3 Server Tests

### elementValidation.test.ts

Tests `isValidWorkspaceId` (regex matching), `isValidElementData` (numeric/text/src validation), `isValidElement` (id, type, data checks), and exported constants.

### permissionService.test.ts

Tests all permission methods: `checkWritePermission`, `checkOwnership`, `calculateEditAccess`, `getSharingInfo`, `validateAndSetToken` across all sharing modes, owner/non-owner combinations, and edge cases.

### securityUtils.test.ts

Tests `safeCompareTokens`: matching tokens, non-matching, different lengths, null/undefined, empty strings, special characters.

### socketHandlers.test.ts

Both `workspaceService` and `permissionService` are fully mocked. Tests cover:
- `handleJoinWorkspace`: workspace creation, joining, owner setup, token validation, error handling
- `handleWhiteboardUpdate`: element storage, queue calls, input validation, permission checks
- `handleWhiteboardClear`: drawing clear and broadcast
- `handleDeleteElement`: element removal and broadcast
- `handleCodeUpdate`: content validation, length limits
- `handleGetEditToken`: owner-only access
- `handleSetEditToken`: format validation
- `handleChangeSharingMode`: mode validation and broadcast
- `handleEndSession`: client disconnection
- `handleDisconnect`: cleanup and user-left emission

### workspaceService.test.ts

Uses `vi.useFakeTimers()` for time-dependent tests. Covers:
- `generateKey`: length and uniqueness
- `generateEditToken`: format and uniqueness
- `createWorkspace`: all required fields
- Connection management: add, remove, count, deduplication
- User session CRUD
- `getWorkspaceUsers`: owner flag, empty cases, sessions without connections
- `cleanupInactiveWorkspaces`: age threshold, active connections, inactive young workspaces
- `getWorkspaceState`: complete state, empty workspace defaults
- `updateSharingMode`: validation and update

### yjsUtils.test.ts

Tests `WSSharedDoc` creation, connections map, awareness, data operations, text type for code editing, update events, garbage collection. Tests `cleanupYjsDoc` for non-existent workspaces.

## 13.4 Load Tests

The load testing system lives in `tests/load/` and is a custom Socket.IO-based load generator.

### How It Works

The entry point is `tests/load/index.js`. It parses CLI arguments, selects a test profile, creates a `MetricsCollector`, runs the scenario, and prints a pass/fail report.

```bash
node tests/load/index.js 30
# or
npm run load-test:30
```

CLI options:
- `--workspace=ID` (specific workspace)
- `--server=URL` (override server URL, default `http://localhost:3000`)
- `--burst-size=N` (users per burst)
- `--burst-count=N` (number of bursts)

### SimulatedUser

Each instance represents one connected client with a behavior profile (weighted random: LURKER 30%, NORMAL 50%, ACTIVE 20%).

Actions simulated:
- **Draw**: random shapes with random colors/positions, emits `WHITEBOARD_UPDATE`
- **Move element**: picks random element, sends updated position
- **Delete element**: emits `DELETE_ELEMENT`
- **Cursor update**: random position via `CURSOR_POSITION`
- **Freehand drawing session**: `DRAWING_START` -> `DRAWING_STREAM` (50ms intervals, 1-2s) -> `DRAWING_END`
- **Shape drawing session**: `SHAPE_DRAWING_START` -> `SHAPE_DRAWING_UPDATE` (50ms intervals, 1-2s) -> `SHAPE_DRAWING_END`

### Scenarios

1. **Standard**: N users, gradual ramp-up, fixed duration, disconnect all.
2. **Ramp-up**: 10 -> 30 -> 50 -> 70 -> 100 -> 50 -> 0 users with stage durations.
3. **Burst**: Seed user gets edit token. N bursts of simultaneous connections, 30s gap between bursts.

### Metrics

Tracks connection latencies, messages sent/received, throughput (msg/s), errors, active/peak users, memory snapshots.

**Pass/fail thresholds:**
- P95 connection latency <= 500ms
- P99 connection latency <= 1000ms
- Error rate <= 5%
- Average throughput >= 10 msg/s

### Test Profiles

| Profile | Users | Duration | Ramp-up |
|---|---|---|---|
| 10 | 10 | 60s | 5s |
| 30 | 30 | 120s | 10s |
| 50 | 50 | 180s | 15s |
| 70 | 70 | 180s | 20s |
| 100 | 100 | 300s | 30s |

### Running Load Tests

The server must be running first.

```bash
npm run load-test:10    # Light load
npm run load-test:30    # Spec minimum
npm run load-test:50    # Heavy load
npm run load-test:70    # Stress test
npm run load-test:100   # Extreme stress
npm run load-test:ramp  # Progressive ramp-up
npm run load-test:burst # Burst test
```

---

# 14. Configuration

## 14.1 package.json

Root `package.json` declares ES module (`"type": "module"`), requires Node.js >= 20.19.0.

### NPM Scripts

| Script | Description |
|---|---|
| `dev` | Vite dev server (frontend only), port 5173 |
| `build` | Vite production build into `dist/` |
| `server` | Backend server via `tsx server/index.ts` |
| `start` | Alias for `server` |
| `dev:all` | Runs both `dev` and `server` concurrently |
| `test` | Vitest single run |
| `test:docker` | Tests inside Docker via WSL |
| `test:watch` | Vitest watch mode |
| `test:coverage` | Vitest with V8 coverage |
| `lint` | ESLint on the entire project |
| `load-test` | Load test (no args shows help) |
| `load-test:10` through `load-test:100` | Load test with N users |
| `load-test:ramp` | Progressive ramp-up |
| `load-test:burst` | Burst connection test |

### Dependencies by Purpose

- **UI Framework:** React 19, React Router 7, MUI Material 7, Emotion
- **Canvas:** Fabric.js 6.9
- **Code Editing:** Monaco Editor (via `@monaco-editor/react`)
- **Diagramming:** Mermaid 11, nomnoml, plantuml-encoder
- **Real-time:** Socket.IO 4.8, Yjs 13.6, y-websocket, y-monaco
- **Server:** Express 5, cors, helmet, express-rate-limit
- **Styling:** Tailwind CSS 4 (via Vite plugin)
- **Build:** Vite 7, TypeScript 5, tsx, concurrently
- **Validation:** Zod 4
- **Security:** DOMPurify
- **i18n:** i18next, react-i18next, i18next-browser-languagedetector
- **Utilities:** lodash, uuid, hotkeys-js, perfect-cursors, lib0

## 14.2 TypeScript Configuration

**`tsconfig.json`** (client + tests):
- Target: ES2022, Module: ESNext, bundler resolution
- JSX: react-jsx, Strict mode enabled
- `noEmit: true` (Vite handles bundling)
- Path alias: `@/*` -> `./client/src/*`

**`tsconfig.server.json`** (server):
- Target: ES2022, no DOM libs
- Path aliases: `@server/*` -> `./server/*`, `@shared/*` -> `./shared/*`

## 14.3 Vite Configuration

- **Root:** `./client`, output to `../dist`
- **Plugins:** `@vitejs/plugin-react`, `@tailwindcss/vite`
- **Dev server:** port 5173, proxies `/api`, `/socket.io`, `/yjs` to backend at `http://localhost:3000` (WebSocket support enabled)
- **Code splitting:** three separate chunks: `monaco`, `fabric`, `mermaid`
- **Pre-bundling:** force-includes 19 MUI icon components
- **Path alias:** `@` -> `client/src`

## 14.4 ESLint Configuration

Flat config format. Applies to `**/*.{js,jsx}` files only.

Plugins: `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.

Key rules: `no-unused-vars: 'warn'` (ignores `_` prefixed), `no-console: 'off'`, `react-hooks/exhaustive-deps: 'warn'`.

## 14.5 Docker

`docker-compose.yml` defines three services.

**Development mode** (default): two services

- **frontend**: `node:20-alpine`, runs `npm install && npm run dev`, port 5173
- **backend**: `node:20-alpine`, runs `npm install && npm run server`, port 3000

Both mount the project root with `node_modules` excluded via anonymous volume.

**Production mode** (`prod` profile):

- **production**: builds from `Dockerfile`, port 3000

```bash
# Development
docker-compose up

# Production
docker-compose --profile prod up production --build
```

---

# 15. Project Setup

### Prerequisites

- Node.js >= 20.19.0
- npm (included with Node.js)
- Docker (optional)

### Install

```bash
git clone <repository-url>
cd shareboard
npm install
```

### Development

Start both frontend and backend together:
```bash
npm run dev:all
```

This runs Vite dev server at http://localhost:5173 and Express server at http://localhost:3000. The Vite dev server proxies `/api`, `/socket.io`, and `/yjs` to the backend automatically.

Or run them separately:
```bash
npm run server   # Terminal 1
npm run dev      # Terminal 2
```

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

If the backend runs on a different origin, create `client/.env.local`:
```
VITE_API_URL=https://your-backend.example.com
```

### Running Tests

```bash
npm test              # Single run
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Linting

```bash
npm run lint
```
