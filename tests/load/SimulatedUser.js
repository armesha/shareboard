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
  constructor(userId, workspaceId, metrics, behaviorType = null, editToken = null) {
    this.userId = userId;
    this.workspaceId = workspaceId;
    this.metrics = metrics;
    this.socket = null;
    this.connected = false;
    this.elements = [];
    this.intervals = [];
    this.behavior = this.selectBehavior(behaviorType);
    this.lastActivity = Date.now();
    this.editToken = editToken;
    this.hasEditAccess = false;
    this.isDrawingActive = false;
    this.drawingSessionTimeout = null;
    this.isShapeDrawingActive = false;
    this.shapeDrawingSessionTimeout = null;
  }

  selectBehavior(type) {
    if (type) return USER_BEHAVIOR[type];

    const rand = Math.random();
    let cumulative = 0;

    for (const behavior of Object.values(USER_BEHAVIOR)) {
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
          accessToken: this.editToken,
        });
      });

      this.socket.on(SOCKET_EVENTS.WORKSPACE_STATE, (state) => {
        if (state?.drawings) {
          this.elements = state.drawings.map(d => d.id);
        }
      });

      this.socket.on('sharing-info', (info) => {
        this.hasEditAccess = info.hasEditAccess;
        if (info.editToken && !this.editToken) {
          this.editToken = info.editToken;
        }
        if (!this.hasEditAccess && this.editToken) {
          this.socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, {
            workspaceId: this.workspaceId,
            userId: this.userId,
            accessToken: this.editToken,
          });
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

    const drawingSessionInterval = setInterval(() => {
      if (this.connected && !this.isDrawingActive && Math.random() < this.behavior.drawingStreamProbability) {
        this.startDrawingSession();
      }
    }, TIMING.DRAWING_SESSION_CHECK_INTERVAL);

    const shapeDrawingInterval = setInterval(() => {
      if (this.connected && !this.isShapeDrawingActive && Math.random() < this.behavior.shapeDrawingProbability) {
        this.startShapeDrawingSession();
      }
    }, TIMING.SHAPE_DRAWING_CHECK_INTERVAL);

    this.intervals = [drawInterval, moveInterval, deleteInterval, cursorInterval, drawingSessionInterval, shapeDrawingInterval];
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

  startDrawingSession() {
    if (this.isDrawingActive || !this.connected) return;

    this.isDrawingActive = true;
    const drawingId = uuidv4();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const strokeWidth = 2 + Math.floor(Math.random() * 4);

    const startX = this.randomCoord(CANVAS.WIDTH);
    const startY = this.randomCoord(CANVAS.HEIGHT);

    let currentX = startX;
    let currentY = startY;
    const points = [{ x: startX, y: startY }];

    this.socket.emit(SOCKET_EVENTS.DRAWING_START, {
      workspaceId: this.workspaceId,
      drawingId,
      startPoint: { x: startX, y: startY },
      color,
      strokeWidth,
    });
    this.metrics.recordSend(Date.now());

    const sessionDuration = TIMING.DRAWING_SESSION_MIN_DURATION +
      Math.random() * (TIMING.DRAWING_SESSION_MAX_DURATION - TIMING.DRAWING_SESSION_MIN_DURATION);

    const streamInterval = setInterval(() => {
      if (!this.connected || !this.isDrawingActive) {
        clearInterval(streamInterval);
        return;
      }

      currentX += (Math.random() - 0.5) * 40;
      currentY += (Math.random() - 0.5) * 40;
      currentX = Math.max(0, Math.min(CANVAS.WIDTH, currentX));
      currentY = Math.max(0, Math.min(CANVAS.HEIGHT, currentY));

      const point = { x: currentX, y: currentY };
      points.push(point);

      this.socket.emit(SOCKET_EVENTS.DRAWING_STREAM, {
        workspaceId: this.workspaceId,
        drawingId,
        point,
      });
      this.metrics.recordSend(Date.now());
    }, TIMING.DRAWING_STREAM_INTERVAL);

    this.drawingSessionTimeout = setTimeout(() => {
      clearInterval(streamInterval);

      if (this.connected) {
        this.socket.emit(SOCKET_EVENTS.DRAWING_END, {
          workspaceId: this.workspaceId,
          drawingId,
          points,
          color,
          strokeWidth,
        });
        this.metrics.recordSend(Date.now());
      }

      this.isDrawingActive = false;
      this.drawingSessionTimeout = null;
    }, sessionDuration);

    this.lastActivity = Date.now();
  }

  startShapeDrawingSession() {
    if (this.isShapeDrawingActive || !this.connected) return;

    this.isShapeDrawingActive = true;
    const shapeId = uuidv4();
    const shapeTypes = ['rect', 'circle', 'line', 'arrow'];
    const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const strokeWidth = 2 + Math.floor(Math.random() * 4);

    const startX = this.randomCoord(CANVAS.WIDTH);
    const startY = this.randomCoord(CANVAS.HEIGHT);
    let currentWidth = 10;
    let currentHeight = 10;
    let currentX2 = startX + 10;
    let currentY2 = startY + 10;

    const isLineType = shapeType === 'line' || shapeType === 'arrow';

    const initialData = isLineType
      ? {
          x1: startX,
          y1: startY,
          x2: currentX2,
          y2: currentY2,
          stroke: color,
          strokeWidth,
        }
      : {
          left: startX,
          top: startY,
          width: currentWidth,
          height: currentHeight,
          stroke: color,
          strokeWidth,
          fill: 'transparent',
        };

    this.socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_START, {
      workspaceId: this.workspaceId,
      shapeId,
      shapeType,
      data: initialData,
    });
    this.metrics.recordSend(Date.now());

    const sessionDuration = TIMING.SHAPE_DRAWING_MIN_DURATION +
      Math.random() * (TIMING.SHAPE_DRAWING_MAX_DURATION - TIMING.SHAPE_DRAWING_MIN_DURATION);

    const updateInterval = setInterval(() => {
      if (!this.connected || !this.isShapeDrawingActive) {
        clearInterval(updateInterval);
        return;
      }

      if (isLineType) {
        currentX2 += (Math.random() - 0.3) * 30;
        currentY2 += (Math.random() - 0.3) * 30;
        currentX2 = Math.max(0, Math.min(CANVAS.WIDTH, currentX2));
        currentY2 = Math.max(0, Math.min(CANVAS.HEIGHT, currentY2));

        this.socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
          workspaceId: this.workspaceId,
          shapeId,
          data: {
            x1: startX,
            y1: startY,
            x2: currentX2,
            y2: currentY2,
            stroke: color,
            strokeWidth,
          },
        });
      } else {
        currentWidth += (Math.random() - 0.2) * 20;
        currentHeight += (Math.random() - 0.2) * 20;
        currentWidth = Math.max(10, Math.min(500, currentWidth));
        currentHeight = Math.max(10, Math.min(500, currentHeight));

        this.socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_UPDATE, {
          workspaceId: this.workspaceId,
          shapeId,
          data: {
            left: startX,
            top: startY,
            width: currentWidth,
            height: currentHeight,
            stroke: color,
            strokeWidth,
            fill: 'transparent',
          },
        });
      }

      this.metrics.recordSend(Date.now());
    }, TIMING.SHAPE_DRAWING_UPDATE_INTERVAL);

    this.shapeDrawingSessionTimeout = setTimeout(() => {
      clearInterval(updateInterval);

      if (this.connected) {
        const finalData = isLineType
          ? {
              x1: startX,
              y1: startY,
              x2: currentX2,
              y2: currentY2,
              stroke: color,
              strokeWidth,
            }
          : {
              left: startX,
              top: startY,
              width: currentWidth,
              height: currentHeight,
              stroke: color,
              strokeWidth,
              fill: 'transparent',
            };

        this.socket.emit(SOCKET_EVENTS.SHAPE_DRAWING_END, {
          workspaceId: this.workspaceId,
          shapeId,
          shapeType,
          data: finalData,
        });
        this.metrics.recordSend(Date.now());
        this.elements.push(shapeId);
      }

      this.isShapeDrawingActive = false;
      this.shapeDrawingSessionTimeout = null;
    }, sessionDuration);

    this.lastActivity = Date.now();
  }

  disconnect() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    if (this.drawingSessionTimeout) {
      clearTimeout(this.drawingSessionTimeout);
      this.drawingSessionTimeout = null;
    }
    this.isDrawingActive = false;

    if (this.shapeDrawingSessionTimeout) {
      clearTimeout(this.shapeDrawingSessionTimeout);
      this.shapeDrawingSessionTimeout = null;
    }
    this.isShapeDrawingActive = false;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
