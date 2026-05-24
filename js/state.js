import {
  teams,
  DOT_MAX_HEALTH,
  MAP_COUNT,
  CUSTOM_MAP_ID,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  RANDOM_MAP_ID
} from './config.js';

export function createState(){
  const state = {
    WIDTH: DEFAULT_WIDTH,
    HEIGHT: DEFAULT_HEIGHT,
    gridW: DEFAULT_WIDTH,
    gridH: DEFAULT_HEIGHT,
    teamSize: 400,
    expertMode: false,
    selectedTeam: 0,
    dots: [],
    field: [],
    players: [],
    running: false,
    paused: false,
    gameOver: false,
    gameStartMs: 0,
    timeLimitMs: 0,
    lastFrameMs: 0,
    frameCounter: 0,
    pendingRestart: null,
    teamSizeInput: null,
    sizeOverrideBtn: null,
    mapPreview: null,
    customMapPanel: null,
    customCollisionInput: null,
    customDisplayInput: null,
    customMapStatus: null,
    customMapCollisionUrl: '',
    customMapDisplayUrl: '',
    mapWalls: null,
    mapLoaded: false,
    selectedMapId: RANDOM_MAP_ID,
    currentMapId: RANDOM_MAP_ID,
    mapLoadToken: 0
  };

  const mapCanvas = document.createElement('canvas');
  const mapCtx = mapCanvas.getContext('2d');
  const mapMaskCanvas = document.createElement('canvas');
  const mapMaskCtx = mapMaskCanvas.getContext('2d');
  state.mapCanvas = mapCanvas;
  state.mapCtx = mapCtx;
  state.mapMaskCanvas = mapMaskCanvas;
  state.mapMaskCtx = mapMaskCtx;

  function inBounds(x, y){
    return x >= 0 && y >= 0 && x < state.WIDTH && y < state.HEIGHT;
  }

  function makeContext(extra){
    const hooks = extra || {};
    return {
      WIDTH: state.WIDTH,
      HEIGHT: state.HEIGHT,
      MAP_COUNT: MAP_COUNT,
      CUSTOM_MAP_ID: CUSTOM_MAP_ID,
      DOT_MAX_HEALTH: DOT_MAX_HEALTH,
      teams: teams,
      selectedTeam: state.selectedTeam,
      dots: state.dots,
      field: state.field,
      players: state.players,
      mapCanvas: mapCanvas,
      mapCtx: mapCtx,
      mapMaskCanvas: mapMaskCanvas,
      mapMaskCtx: mapMaskCtx,
      get mapWalls(){ return state.mapWalls; },
      set mapWalls(value){ state.mapWalls = value; },
      get mapLoaded(){ return state.mapLoaded; },
      set mapLoaded(value){ state.mapLoaded = value; },
      get selectedMapId(){ return state.selectedMapId; },
      set selectedMapId(value){ state.selectedMapId = value; },
      get currentMapId(){ return state.currentMapId; },
      set currentMapId(value){ state.currentMapId = value; },
      get mapLoadToken(){ return state.mapLoadToken; },
      set mapLoadToken(value){ state.mapLoadToken = value; },
      teamSizeInput: state.teamSizeInput,
      sizeOverrideBtn: state.sizeOverrideBtn,
      mapPreview: state.mapPreview,
      customMapPanel: state.customMapPanel,
      customCollisionInput: state.customCollisionInput,
      customDisplayInput: state.customDisplayInput,
      customMapStatus: state.customMapStatus,
      get customMapCollisionUrl(){ return state.customMapCollisionUrl; },
      set customMapCollisionUrl(value){ state.customMapCollisionUrl = value; },
      get customMapDisplayUrl(){ return state.customMapDisplayUrl; },
      set customMapDisplayUrl(value){ state.customMapDisplayUrl = value; },
      inBounds: inBounds,
      refreshMapPreview: hooks.refreshMapPreview
    };
  }

  return { state, mapCanvas, makeContext, inBounds };
}
