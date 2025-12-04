export const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

export { SOCKET_EVENTS } from '../../shared/constants.js';

export const SHAPES = ['rect', 'circle', 'triangle', 'line', 'arrow', 'path'];

export const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#808080', '#8B4513', '#800080'
];

export const CANVAS = {
  WIDTH: 1920,
  HEIGHT: 1080,
  MIN_SIZE: 20,
  MAX_SIZE: 200,
};

export const TIMING = {
  MOVEMENT_INTERVAL: 50,
  DRAW_INTERVAL: 200,
  DELETE_INTERVAL: 5000,
  CURSOR_INTERVAL: 500,
  RAMP_UP_DELAY: 100,
  DRAWING_STREAM_INTERVAL: 50,
  DRAWING_SESSION_MIN_DURATION: 1000,
  DRAWING_SESSION_MAX_DURATION: 2000,
  DRAWING_SESSION_CHECK_INTERVAL: 3000,
  SHAPE_DRAWING_UPDATE_INTERVAL: 50,
  SHAPE_DRAWING_MIN_DURATION: 1000,
  SHAPE_DRAWING_MAX_DURATION: 2000,
  SHAPE_DRAWING_CHECK_INTERVAL: 2500,
};

export const TEST_PROFILES = {
  10: {
    name: 'Light Load',
    users: 10,
    duration: 60000,
    rampUpTime: 5000,
    description: '10 users for 1 minute',
  },
  30: {
    name: 'Normal Load (Spec Minimum)',
    users: 30,
    duration: 120000,
    rampUpTime: 10000,
    description: '30 users for 2 minutes - minimum per specification',
  },
  50: {
    name: 'Heavy Load',
    users: 50,
    duration: 180000,
    rampUpTime: 15000,
    description: '50 users for 3 minutes',
  },
  70: {
    name: 'Stress Test',
    users: 70,
    duration: 180000,
    rampUpTime: 20000,
    description: '70 users for 3 minutes - stress test',
  },
  100: {
    name: 'Extreme Stress Test',
    users: 100,
    duration: 300000,
    rampUpTime: 30000,
    description: '100 users for 5 minutes - extreme stress',
  },
};

export const USER_BEHAVIOR = {
  LURKER: {
    weight: 0.3,
    drawProbability: 0.1,
    moveProbability: 0.05,
    deleteProbability: 0.01,
    drawingStreamProbability: 0.05,
    shapeDrawingProbability: 0.05,
  },
  NORMAL: {
    weight: 0.5,
    drawProbability: 0.4,
    moveProbability: 0.3,
    deleteProbability: 0.05,
    drawingStreamProbability: 0.2,
    shapeDrawingProbability: 0.2,
  },
  ACTIVE: {
    weight: 0.2,
    drawProbability: 0.7,
    moveProbability: 0.5,
    deleteProbability: 0.1,
    drawingStreamProbability: 0.4,
    shapeDrawingProbability: 0.4,
  },
};

export const THRESHOLDS = {
  MAX_LATENCY_P95: 500,
  MAX_LATENCY_P99: 1000,
  MAX_ERROR_RATE: 0.05,
  MIN_THROUGHPUT: 10,
};
