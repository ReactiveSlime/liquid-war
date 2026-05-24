/* Liquid Wars web remake - bootstrap with multiplayer */
import { MAP_COUNT, RANDOM_MAP_ID, CUSTOM_MAP_ID } from './config.js';
import { createState } from './state.js';
import { createGame } from './game.js';
import { init as initAudio } from './audio.js';
import { initUIOverlays, initPlayControls, initMainUI } from './ui.js';
import { initMenu } from './ui-controller.js';
import { bindLayoutObservers, resize } from './layout.js';
import { initPointerInput } from './input.js';
import { MultiplayerClient } from './multiplayer.js';
import { initMultiplayerUI } from './multiplayer-ui.js';
import { clearCustomMapUrls } from './map-custom.js';
import { ServerSelector } from './server-selector.js';

let SERVER_URL = (typeof window !== 'undefined' && window.LIQUID_WARS_SERVER_URL)
  || 'https://server.liquid-war.reactivesli.me';

const serverSelector = new ServerSelector();
let serverName = 'Connecting...';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const playSessionEl = document.getElementById('playSession');
const uiEl = document.getElementById('ui');
const playMain = document.getElementById('playMain');

const { state, makeContext: makeContextBase } = createState();

// Initialize server selector and connect to best server
async function initializeMultiplayer() {
  try {
    await serverSelector.loadServers('./servers.json');
    await serverSelector.selectBestServer();
    SERVER_URL = serverSelector.getSelectedServerUrl();
    serverName = serverSelector.getSelectedServerName();
    console.log(`Connected to: ${serverName}`);
  } catch (error) {
    console.error('Server selection failed, using default:', error);
    serverName = 'Default Server';
  }
  
  return new MultiplayerClient(SERVER_URL);
}

const mpClient = await initializeMultiplayer();

// Attach server selector to mpClient for UI access
mpClient.serverSelector = serverSelector;

let mpUi = null;
let toastTimer = null;
// Menu and lobby transitions are managed in js/ui-controller.js

const game = createGame({
  canvas,
  ctx,
  playSessionEl,
  uiEl,
  state,
  makeContextBase,
  MAP_COUNT,
  initMainUI,
  initPlayControls,
  multiplayerClient: mpClient,
  onMultiplayerQuit(){
    mpClient.returnToMenu().catch(() => {});
    if(mpUi) mpUi.showMultiplayerLobby();
  }
});

initPointerInput(canvas, playSessionEl, state, {
  onPlayerMove(position){
    if(!state.isMultiplayer || !state.running) return;
    mpClient.sendPlayerPosition(position);
  }
});

mpClient.on('game-state-update', (payload) => {
  if(state.isMultiplayer && !state.mpIsHost){
    game.applyRemoteGameState(payload);
  }
});

mpClient.on('request-full-state', () => {
  if(state.isMultiplayer && state.mpIsHost){
    game.forceBroadcastStateFull();
  }
});

mpClient.on('player-position', (payload) => {
  if(!state.isMultiplayer || !state.running) return;
  if(state.mpIsHost){
    game.applyHostPlayerPosition(payload);
  } else {
    game.applyRemotePlayerPosition(payload);
  }
});

mpClient.on('game-ended', (result) => {
  if(state.isMultiplayer) game.endMatchFromNetwork(result);
});
game.setupStartScreen();
game.initPlayControls();

bindLayoutObservers(canvas, playMain, playSessionEl, function(){
  resize(canvas);
});

initAudio();
initUIOverlays();
mpUi = initMenu({
  state,
  makeContextBase,
  game,
  mpClient,
  initMainUI,
  initMultiplayerUI,
  clearCustomMapUrls,
  serverName
});

window.liquidWars = {
  state,
  game,
  multiplayerClient: mpClient,
  get isHost(){ return mpClient.isHost; },
  get gameMode(){ return state.isMultiplayer ? 'multiplayer' : 'single'; }
};

// Custom server configuration methods
window.liquidWars.refreshServerConnection = async () => {
  await mpClient.serverSelector.selectBestServer();
  const newUrl = mpClient.serverSelector.getSelectedServerUrl();
  if(newUrl && newUrl !== SERVER_URL){
    SERVER_URL = newUrl;
    serverName = mpClient.serverSelector.getSelectedServerName();
    mpClient.serverUrl = newUrl;
    await mpClient.reconnect();
    console.log(`Server changed to: ${serverName}`);
  }
};

window.liquidWars.setCustomServer = async (url, name) => {
  mpClient.serverSelector.setCustomServer(url, name || new URL(url).hostname);
  await window.liquidWars.refreshServerConnection();
};

window.liquidWars.clearCustomServer = async () => {
  mpClient.serverSelector.clearCustomServer();
  await window.liquidWars.refreshServerConnection();
};

game.loop();
