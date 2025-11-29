import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  SERVER_URL,
  SOCKET_EVENTS,
  SHAPES,
  COLORS,
  CANVAS,
  TIMING,
  USER_BEHAVIOR,
} from './config.js';

export class SimulatedUser {
  constructor(userId, workspaceId, metrics, behaviorType = null) {
    this.userId = userId;
    this.workspaceId = workspaceId;
    this.metrics = metrics;
    this.socket = null;
    this.connected = false;
    this.elements = [];
    this.intervals = [];
    this.behavior = this.selectBehavior(behaviorType);
    this.lastActivity = Date.now();
  }

  selectBehavior(type) {
    if (type) return USER_BEHAVIOR[type];

    const rand = Math.random();
    let cumulative = 0;

    for (const [name, behavior] of Object.entries(USER_BEHAVIOR)) {
      cumulative += behavior.weight;
      if (rand <= cumulative) {
        return behavior;
      }
    }
    return USER_BEHAVIOR.NORMAL;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const connectStart = Date.now();

      this.socket = io(SERVER_URL, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
        timeout: 10000,
      });

      const timeout = setTimeout(() => {
        this.socket.disconnect();
        reject(new Error(`Connection timeout for user ${this.userId}`));
      }, 15000);

      this.socket.on(SOCKET_EVENTS.CONNECT, () => {
        clearTimeout(timeout);
        this.connected = true;
        this.metrics.recordConnect(Date.now() - connectStart);

        this.socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, {
          workspaceId: this.workspaceId,
          userId: this.userId,
        });
      });

      this.socket.on(SOCKET_EVENTS.WORKSPACE_STATE, (state) => {
        if (state?.drawings) {
          this.elements = state.drawings.map(d => d.id);
        }
        resolve();
      });

      this.socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, (elements) => {
        this.metrics.recordReceive();
        if (Array.isArray(elements)) {
          elements.forEach(el => {
            if (el?.id && !this.elements.includes(el.id)) {
              this.elements.push(el.id);
            }
          });
        }
      });

      this.socket.on(SOCKET_EVENTS.DELETE_ELEMENT, ({ elementId }) => {
        this.elements = this.elements.filter(id => id !== elementId);
      });

      this.socket.on(SOCKET_EVENTS.ERROR, (error) => {
        this.metrics.recordError(error.message || 'Unknown error');
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this.metrics.recordError(`Connect error: ${error.message}`);
        reject(error);
      });

      this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        this.connected = false;
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          return;
        }
        this.metrics.recordError(`Disconnect: ${reason}`);
      });
    });
  }

  startActivity() {
    const drawInterval = setInterval(() => {
      if (this.connected && Math.random() < this.behavior.drawProbability) {
        this.draw();
      }
    }, TIMING.DRAW_INTERVAL);

    const moveInterval = setInterval(() => {
      if (this.connected && this.elements.length > 0 && Math.random() < this.behavior.moveProbability) {
        this.moveElement();
      }
    }, TIMING.MOVEMENT_INTERVAL * 4);

    const deleteInterval = setInterval(() => {
      if (this.connected && this.elements.length > 5 && Math.random() < this.behavior.deleteProbability) {
        this.deleteElement();
      }
    }, TIMING.DELETE_INTERVAL);

    const cursorInterval = setInterval(() => {
      if (this.connected) {
        this.updateCursor();
      }
    }, TIMING.CURSOR_INTERVAL);

    this.intervals = [drawInterval, moveInterval, deleteInterval, cursorInterval];
  }

  draw() {
    const element = this.generateElement();
    const sendTime = Date.now();

    this.socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
      workspaceId: this.workspaceId,
      elements: [element],
    });

    this.elements.push(element.id);
    this.metrics.recordSend(sendTime);
    this.lastActivity = Date.now();
  }

  moveElement() {
    if (this.elements.length === 0) return;

    const elementId = this.elements[Math.floor(Math.random() * this.elements.length)];
    const sendTime = Date.now();

    this.socket.emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
      workspaceId: this.workspaceId,
      elements: [{
        id: elementId,
        type: 'rect',
        data: {
          left: this.randomCoord(CANVAS.WIDTH),
          top: this.randomCoord(CANVAS.HEIGHT),
        },
      }],
    });

    this.metrics.recordSend(sendTime);
    this.lastActivity = Date.now();
  }

  deleteElement() {
    if (this.elements.length === 0) return;

    const elementId = this.elements.pop();
    const sendTime = Date.now();

    this.socket.emit(SOCKET_EVENTS.DELETE_ELEMENT, {
      workspaceId: this.workspaceId,
      elementId,
    });

    this.metrics.recordSend(sendTime);
    this.lastActivity = Date.now();
  }

  updateCursor() {
    this.socket.emit(SOCKET_EVENTS.CURSOR_POSITION, {
      workspaceId: this.workspaceId,
      position: {
        x: this.randomCoord(CANVAS.WIDTH),
        y: this.randomCoord(CANVAS.HEIGHT),
      },
    });
  }

  generateElement() {
    const type = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const id = uuidv4();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = CANVAS.MIN_SIZE + Math.random() * (CANVAS.MAX_SIZE - CANVAS.MIN_SIZE);

    const baseData = {
      left: this.randomCoord(CANVAS.WIDTH),
      top: this.randomCoord(CANVAS.HEIGHT),
      stroke: color,
      strokeWidth: 2,
      fill: Math.random() > 0.5 ? 'transparent' : color,
      opacity: 0.8 + Math.random() * 0.2,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
    };

    let data;
    switch (type) {
      case 'line':
      case 'arrow':
        data = {
          ...baseData,
          x1: baseData.left,
          y1: baseData.top,
          x2: baseData.left + size,
          y2: baseData.top + size * (Math.random() - 0.5),
        };
        break;
      case 'path':
        data = {
          ...baseData,
          path: this.generateRandomPath(baseData.left, baseData.top),
        };
        break;
      default:
        data = {
          ...baseData,
          width: size,
          height: size * (0.5 + Math.random()),
        };
    }

    return { id, type, data, timestamp: Date.now() };
  }

  generateRandomPath(startX, startY) {
    let path = `M ${startX} ${startY}`;
    const points = 5 + Math.floor(Math.random() * 10);

    for (let i = 0; i < points; i++) {
      const x = startX + (Math.random() - 0.5) * 200;
      const y = startY + (Math.random() - 0.5) * 200;
      path += ` L ${x} ${y}`;
    }

    return path;
  }

  randomCoord(max) {
    return Math.floor(Math.random() * max * 0.8) + max * 0.1;
  }

  disconnect() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
