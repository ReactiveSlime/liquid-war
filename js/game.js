import * as Movement from './movement.js';
import * as MapNormal from './map-normal.js';
import * as MapCustom from './map-custom.js';
import { playOutcomeSound } from './audio.js';
import { updateScoresUI as renderScoresUI } from './ui.js';
import {
  teams,
  teamNames,
  colours,
  RANDOM_MAP_ID,
  CUSTOM_MAP_ID,
  DEFAULT_TEAM_SIZE_MAX,
  EXPERT_TEAM_SIZE_MAX
} from './config.js';
import { draw } from './render.js';
import { updatePlayLayout, resize, setPlaySessionActive, setGameHudVisible } from './layout.js';

const MP_STATE_SYNC_INTERVAL = 3;
const MP_PACKET_FORMAT = 'lwsp1';
const MP_FULL_SNAPSHOT_EVERY_SENDS = 30;
const TARGET_TICK_RATE = 30;
const TARGET_TICK_MS = 1000 / TARGET_TICK_RATE;
const MAX_TICKS_PER_FRAME = 5;
const DOT_X_BITS = 10;
const DOT_Y_BITS = 10;
const DOT_TEAM_BITS = 3;
const DOT_HEALTH_BITS = 4;
const DOT_X_MASK = (1 << DOT_X_BITS) - 1;
const DOT_Y_MASK = (1 << DOT_Y_BITS) - 1;
const DOT_TEAM_MASK = (1 << DOT_TEAM_BITS) - 1;
const DOT_HEALTH_MASK = (1 << DOT_HEALTH_BITS) - 1;

export function createGame(deps){
  const {
    canvas,
    ctx,
    playSessionEl,
    uiEl,
    state,
    makeContextBase
  } = deps;

  function makeContext(){
    return makeContextBase({ refreshMapPreview: refreshMapPreview });
  }

  let mpHostLastPackedDots = null;
  let mpHostLastFrame = 0;
  let mpHostSnapshotSendCount = 0;
  let mpClientLastPackedDots = null;
  let mpClientLastFrame = 0;
  let simulationAccumulatorMs = 0;
  // correction buffers for client-side prediction reconciliation
  let mpCorrections = {
    dots: new Map(), // index -> { x,y,team,health, ticks }
    players: new Map(), // team -> { x,y, ticks }
    reconcileTicks: 6
  };

  function clampInt(value, min, max){
    if(!Number.isFinite(value)) return min;
    const n = value | 0;
    if(n < min) return min;
    if(n > max) return max;
    return n;
  }

  function packDot(dot){
    const x = clampInt(dot?.x, 0, DOT_X_MASK);
    const y = clampInt(dot?.y, 0, DOT_Y_MASK);
    const team = clampInt(dot?.team, 0, DOT_TEAM_MASK);
    const health = clampInt(dot?.health, 0, DOT_HEALTH_MASK);
    return (x)
      | (y << DOT_X_BITS)
      | (team << (DOT_X_BITS + DOT_Y_BITS))
      | (health << (DOT_X_BITS + DOT_Y_BITS + DOT_TEAM_BITS));
  }

  function unpackDot(packed){
    const value = Number(packed) >>> 0;
    return {
      x: value & DOT_X_MASK,
      y: (value >>> DOT_X_BITS) & DOT_Y_MASK,
      team: (value >>> (DOT_X_BITS + DOT_Y_BITS)) & DOT_TEAM_MASK,
      health: (value >>> (DOT_X_BITS + DOT_Y_BITS + DOT_TEAM_BITS)) & DOT_HEALTH_MASK
    };
  }

  function packPlayers(){
    const packed = new Uint16Array(state.players.length * 2);
    for(let i = 0; i < state.players.length; i++){
      const p = state.players[i] || { x: 0, y: 0 };
      packed[(i * 2)] = clampInt(p.x, 0, DOT_X_MASK);
      packed[(i * 2) + 1] = clampInt(p.y, 0, DOT_Y_MASK);
    }
    return packed;
  }

  function applyPackedPlayers(packedPlayers){
    if(!packedPlayers) return;
    const packed = toUint16Array(packedPlayers);
    const size = Math.min(state.players.length, Math.floor(packed.length / 2));
    for(let i = 0; i < size; i++){
      if(!state.players[i]) continue;
      state.players[i].x = packed[(i * 2)] | 0;
      state.players[i].y = packed[(i * 2) + 1] | 0;
    }
  }

  function toUint16Array(value){
    if(value instanceof Uint16Array) return value;
    if(value instanceof ArrayBuffer) return new Uint16Array(value);
    if(ArrayBuffer.isView(value)) {
      return new Uint16Array(value.buffer, value.byteOffset, Math.floor(value.byteLength / Uint16Array.BYTES_PER_ELEMENT));
    }
    if(Array.isArray(value)) return Uint16Array.from(value);
    return new Uint16Array(0);
  }

  function toUint32Array(value){
    if(value instanceof Uint32Array) return value;
    if(value instanceof ArrayBuffer) return new Uint32Array(value);
    if(ArrayBuffer.isView(value)) {
      return new Uint32Array(value.buffer, value.byteOffset, Math.floor(value.byteLength / Uint32Array.BYTES_PER_ELEMENT));
    }
    if(Array.isArray(value)) return Uint32Array.from(value);
    return new Uint32Array(0);
  }

  function serializeGameStatePacket(forceFull){
    const frame = state.frameCounter | 0;
    const players = packPlayers();
    const dots = new Uint32Array(state.dots.length);
    for(let i = 0; i < state.dots.length; i++){
      dots[i] = packDot(state.dots[i]);
    }

    const periodicFull = (mpHostSnapshotSendCount % MP_FULL_SNAPSHOT_EVERY_SENDS) === 0;
    const canDelta = !forceFull
      && !!mpHostLastPackedDots
      && mpHostLastPackedDots.length === dots.length
      && !periodicFull;

    let packet;
    if(canDelta){
      const changedIndices = [];
      const changedDots = [];
      for(let i = 0; i < dots.length; i++){
        if(dots[i] !== mpHostLastPackedDots[i]){
          changedIndices.push(i);
          changedDots.push(dots[i]);
        }
      }

      const deltaTooLarge = changedDots.length > (dots.length * 0.85);
      if(deltaTooLarge){
        packet = {
          format: MP_PACKET_FORMAT,
          kind: 'full',
          frame,
          totalDots: dots.length,
          players,
          dots
        };
      } else {
        packet = {
          format: MP_PACKET_FORMAT,
          kind: 'delta',
          frame,
          baselineFrame: mpHostLastFrame,
          totalDots: dots.length,
          players,
          changedIndices: Uint16Array.from(changedIndices),
          changedDots: Uint32Array.from(changedDots)
        };
      }
    } else {
      packet = {
        format: MP_PACKET_FORMAT,
        kind: 'full',
        frame,
        totalDots: dots.length,
        players,
        dots
      };
    }

    mpHostLastPackedDots = dots.slice();
    mpHostLastFrame = frame;
    mpHostSnapshotSendCount++;
    return packet;
  }

  function getTeamSizeLimit(){
    return state.expertMode ? EXPERT_TEAM_SIZE_MAX : DEFAULT_TEAM_SIZE_MAX;
  }

  function setExpertMode(enabled){
    state.expertMode = !!enabled;
    if(state.teamSizeInput){
      state.teamSizeInput.max = getTeamSizeLimit();
      const currentValue = parseInt(state.teamSizeInput.value, 10) || 400;
      if(currentValue > getTeamSizeLimit()){
        state.teamSizeInput.value = getTeamSizeLimit();
      }
    }
    if(state.sizeOverrideBtn){
      state.sizeOverrideBtn.classList.toggle('is-active', state.expertMode);
      state.sizeOverrideBtn.textContent = state.expertMode
        ? 'Warning: 1000-unit cap is OFF'
        : 'Warning: disable the 1000-unit cap';
    }
  }

  function updateCustomMapStatus(message, isError){
    MapCustom.updateCustomMapStatus(makeContext(), message, isError);
  }

  function clearCustomMapUrls(){
    MapCustom.clearCustomMapUrls(makeContext());
  }

  function syncCustomMapFiles(){
    MapCustom.syncCustomMapFiles(makeContext());
  }

  function refreshMapPreview(mapId){
    MapNormal.refreshMapPreview(mapId, makeContext());
  }

  function loadMapById(mapId, cb){
    MapNormal.loadMapById(mapId, makeContext(), cb);
  }

  function findNearestOpenSpot(x, y){
    return Movement.findNearestOpenSpot(makeContext(), x, y);
  }

  function getNearestDot(team, px, py){
    return Movement.getNearestDot(makeContext(), team, px, py);
  }

  function updateScoresUI(){
    renderScoresUI(state.dots, teams, teamNames, colours, state.teamSize);
  }

  function getMpClient(){
    return deps.multiplayerClient || null;
  }

  function teamForSocketId(playerId){
    const mp = getMpClient();
    if(!mp?.players) return null;
    const row = mp.players.find((p) => p.id === playerId);
    return row ? row.team : null;
  }

  function rebuildFieldFromDots(){
    state.field = Array.from({ length: state.WIDTH }, () => Array(state.HEIGHT).fill(null));
    for(let i = 0; i < state.dots.length; i++){
      const d = state.dots[i];
      if(d.x >= 0 && d.x < state.WIDTH && d.y >= 0 && d.y < state.HEIGHT){
        state.field[d.x][d.y] = d;
      }
    }
  }

  function applyRemoteGameState(payload){
    const data = payload?.data ?? payload;
    if(!data) return;

    if(data.format === MP_PACKET_FORMAT){
      if(data.kind === 'full' && data.dots){
        const packedDots = toUint32Array(data.dots);
        mpClientLastPackedDots = packedDots.slice();
        mpClientLastFrame = Number.isFinite(data.frame) ? (data.frame | 0) : 0;

        // apply players and dots as authoritative targets for reconciliation on clients
        if(state.mpIsHost){
          applyPackedPlayers(data.players);
          state.dots = Array.from(packedDots, (packed) => unpackDot(packed));
          rebuildFieldFromDots();
        } else {
          // queue player corrections
          if(Array.isArray(data.players)){
            for(let i = 0; i < data.players.length; i++){
              const pp = data.players[i];
              if(pp && typeof pp.team === 'number' && state.players[pp.team]){
                mpCorrections.players.set(pp.team, { x: pp.x | 0, y: pp.y | 0, ticks: mpCorrections.reconcileTicks });
              }
            }
          }

          // queue dot corrections
          const authoritative = Array.from(packedDots, (packed) => unpackDot(packed));
          if(Array.isArray(state.dots) && state.dots.length === authoritative.length){
            for(let i = 0; i < authoritative.length; i++){
              const auth = authoritative[i];
              const cur = state.dots[i];
              if(!cur) continue;
              if(cur.x !== auth.x || cur.y !== auth.y || cur.team !== auth.team || cur.health !== auth.health){
                mpCorrections.dots.set(i, { x: auth.x, y: auth.y, team: auth.team, health: auth.health, ticks: mpCorrections.reconcileTicks });
              }
            }
          } else {
            // if client has no dots yet, eagerly set them
            state.dots = authoritative;
            rebuildFieldFromDots();
          }
        }

        state.frameCounter = mpClientLastFrame;
        state.mpAwaitingState = false;
        updateScoresUI();
        getMpClient()?.sendSnapshotAck(mpClientLastFrame);
      } else if(data.kind === 'delta' && data.changedIndices && data.changedDots){
        const baselineFrame = Number.isFinite(data.baselineFrame) ? (data.baselineFrame | 0) : -1;
        const totalDots = Number.isFinite(data.totalDots) ? (data.totalDots | 0) : -1;
        if(!mpClientLastPackedDots || baselineFrame !== mpClientLastFrame || totalDots !== mpClientLastPackedDots.length){
          state.mpAwaitingState = true;
          getMpClient()?.requestFullState();
          return;
        }

        // apply players as corrections for clients, immediate for host
        if(state.mpIsHost){
          applyPackedPlayers(data.players);
        } else if(Array.isArray(data.players)){
          for(let i = 0; i < data.players.length; i++){
            const pp = data.players[i];
            if(pp && typeof pp.team === 'number' && state.players[pp.team]){
              mpCorrections.players.set(pp.team, { x: pp.x | 0, y: pp.y | 0, ticks: mpCorrections.reconcileTicks });
            }
          }
        }

        if(!Array.isArray(state.dots) || state.dots.length !== totalDots){
          state.dots = Array.from(mpClientLastPackedDots, (packed) => unpackDot(packed));
          rebuildFieldFromDots();
        }

        if(!Array.isArray(state.field) || !state.field.length){
          state.field = Array.from({ length: state.WIDTH }, () => Array(state.HEIGHT).fill(null));
          rebuildFieldFromDots();
        }

        const changedIndices = toUint16Array(data.changedIndices);
        const changedDots = toUint32Array(data.changedDots);
        const changeCount = Math.min(changedIndices.length, changedDots.length);

        for(let i = 0; i < changeCount; i++){
          const index = changedIndices[i] | 0;
          if(index < 0 || index >= totalDots) continue;

          const previous = state.dots[index];
          const packed = changedDots[i] >>> 0;
          mpClientLastPackedDots[index] = packed;
          const next = unpackDot(packed);

          if(state.mpIsHost){
            if(previous
              && previous.x >= 0 && previous.x < state.WIDTH
              && previous.y >= 0 && previous.y < state.HEIGHT
              && state.field[previous.x][previous.y] === previous){
              state.field[previous.x][previous.y] = null;
            }

            if(previous){
              previous.x = next.x;
              previous.y = next.y;
              previous.team = next.team;
              previous.health = next.health;
            } else {
              state.dots[index] = next;
            }

            const dotRef = state.dots[index];
            if(dotRef.x >= 0 && dotRef.x < state.WIDTH && dotRef.y >= 0 && dotRef.y < state.HEIGHT){
              state.field[dotRef.x][dotRef.y] = dotRef;
            }
          } else {
            // queue reconciliation for this dot index
            if(previous){
              mpCorrections.dots.set(index, { x: next.x, y: next.y, team: next.team, health: next.health, ticks: mpCorrections.reconcileTicks });
            } else {
              // missing locally, insert authoritative
              state.dots[index] = next;
            }
          }
        }

        mpClientLastFrame = Number.isFinite(data.frame) ? (data.frame | 0) : (mpClientLastFrame + MP_STATE_SYNC_INTERVAL);
        state.frameCounter = mpClientLastFrame;
        state.mpAwaitingState = false;
        updateScoresUI();
        getMpClient()?.sendSnapshotAck(mpClientLastFrame);
      }
      return;
    }

    if(!Array.isArray(data.dots)) return;

    if(typeof data.frame === 'number'){
      state.frameCounter = data.frame;
    }

    if(Array.isArray(data.players)){
      for(let i = 0; i < data.players.length; i++){
        const pp = data.players[i];
        if(pp.team == null || !state.players[pp.team]) continue;
        if(state.mpIsHost){
          state.players[pp.team].x = pp.x;
          state.players[pp.team].y = pp.y;
        } else {
          mpCorrections.players.set(pp.team, { x: pp.x | 0, y: pp.y | 0, ticks: mpCorrections.reconcileTicks });
        }
      }
    }

    // authoritative dots: queue reconciliation for clients, apply immediately for host
    const authoritativeDots = data.dots.map((row) => ({ x: row[0], y: row[1], team: row[2], health: row[3] }));
    if(state.mpIsHost){
      state.dots = authoritativeDots;
      rebuildFieldFromDots();
    } else {
      if(Array.isArray(state.dots) && state.dots.length === authoritativeDots.length){
        for(let i = 0; i < authoritativeDots.length; i++){
          const auth = authoritativeDots[i];
          const cur = state.dots[i];
          if(!cur) continue;
          if(cur.x !== auth.x || cur.y !== auth.y || cur.team !== auth.team || cur.health !== auth.health){
            mpCorrections.dots.set(i, { x: auth.x, y: auth.y, team: auth.team, health: auth.health, ticks: mpCorrections.reconcileTicks });
          }
        }
      } else {
        state.dots = authoritativeDots;
        rebuildFieldFromDots();
      }
    }
    state.mpAwaitingState = false;
    updateScoresUI();
  }

  function applyRemotePlayerPosition(payload){
    if(!payload || state.mpIsHost) return;
    const team = typeof payload.position?.team === 'number'
      ? payload.position.team
      : teamForSocketId(payload.playerId);
    if(team == null || team === state.selectedTeam || !state.players[team]) return;
    state.players[team].x = payload.position.x;
    state.players[team].y = payload.position.y;
    state.players[team].ai = false;
  }

  function applyHostPlayerPosition(payload){
    if(!state.mpIsHost || !payload?.position) return;
    const team = typeof payload.position.team === 'number'
      ? payload.position.team
      : teamForSocketId(payload.playerId);
    if(team == null || team === state.selectedTeam || !state.players[team]) return;
    state.players[team].x = payload.position.x;
    state.players[team].y = payload.position.y;
    state.players[team].ai = false;
  }

  function broadcastGameStateIfHost(force){
    const mp = getMpClient();
    if(!state.isMultiplayer || !state.mpIsHost || !mp) return;
    if(!force && (state.frameCounter % MP_STATE_SYNC_INTERVAL) !== 0) return;
    mp.sendGameState(serializeGameStatePacket(!!force));
  }

  function forceBroadcastStateFull(){
    broadcastGameStateIfHost(true);
  }

  function init(size, team, humanTeams){
    state.teamSize = size;
    state.selectedTeam = team;
    document.getElementById('timerInfo').textContent = '';
    state.dots = [];
    state.field = Array.from({ length: state.WIDTH }, () => Array(state.HEIGHT).fill(null));
    state.players = [];

    const XDIS = 40;
    const YDIS = 40;
    const startPos = [
      { x: XDIS, y: state.HEIGHT - YDIS },
      { x: XDIS, y: YDIS },
      { x: Math.floor(state.WIDTH / 2), y: state.HEIGHT - YDIS },
      { x: Math.floor(state.WIDTH / 2), y: YDIS },
      { x: state.WIDTH - XDIS, y: state.HEIGHT - YDIS },
      { x: state.WIDTH - XDIS, y: YDIS }
    ];

    const humanSet = humanTeams instanceof Set
      ? humanTeams
      : new Set(Array.isArray(humanTeams) ? humanTeams : [team]);

    for(let t = 0; t < teams; t++){
      const p = startPos[t];
      state.players.push({ x: p.x, y: p.y, ai: !humanSet.has(t), target: null });
    }

    for(let t = 0; t < teams; t++){
      const center = startPos[t];
      for(let i = 0; i < state.teamSize; i++){
        const jitter = 24;
        let nx = center.x + (Math.random() * (jitter * 2) | 0) - jitter;
        let ny = center.y + (Math.random() * (jitter * 2) | 0) - jitter;
        const spot = findNearestOpenSpot(nx, ny);
        const dot = { team: t, x: spot.x, y: spot.y, health: 5 };
        state.dots.push(dot);
        state.field[dot.x][dot.y] = dot;
      }
    }
    updateScoresUI();
  }

  function beginMatch(opts){
    const options = opts || {};
    const parsedSize = options.teamSize != null
      ? options.teamSize
      : parseInt(state.teamSizeInput.value, 10) || 1000;
    const size = Math.max(5, Math.min(getTeamSizeLimit(), parsedSize));
    if(state.teamSizeInput) state.teamSizeInput.value = size;

    const mapId = options.mapId != null
      ? options.mapId
      : (document.getElementById('mapDropdown')
        ? parseInt(document.getElementById('mapDropdown').value, 10)
        : RANDOM_MAP_ID);
    state.selectedMapId = mapId;

    if(state.selectedMapId === CUSTOM_MAP_ID && !state.customMapCollisionUrl){
      updateCustomMapStatus('Choose a collision image before starting the battle.', true);
      if(state.customMapPanel) state.customMapPanel.hidden = false;
      return false;
    }

    const timerSeconds = options.timerSeconds != null
      ? options.timerSeconds
      : parseInt(document.getElementById('gameTimer').value, 10) || 0;
    const team = options.team != null ? options.team : state.selectedTeam;
    const humanTeams = options.humanTeams || [team];
    const timerInfo = document.getElementById('timerInfo');

    state.selectedTeam = team;
    state.timeLimitMs = timerSeconds > 0 ? timerSeconds * 1000 : 0;
    state.gameStartMs = performance.now();
    state.lastFrameMs = state.gameStartMs;
    state.frameCounter = 0;
    state.gameOver = false;
    state.paused = false;
    state.isMultiplayer = !!options.isMultiplayer;
    const mp = getMpClient();
    state.mpIsHost = state.isMultiplayer && !!mp?.isHost;
    state.mpAwaitingState = state.isMultiplayer && !state.mpIsHost;
    mpHostLastPackedDots = null;
    mpHostLastFrame = 0;
    mpHostSnapshotSendCount = 0;
    mpClientLastPackedDots = null;
    mpClientLastFrame = 0;
    simulationAccumulatorMs = 0;
    // clear any pending corrections when starting a match
    mpCorrections.dots.clear();
    mpCorrections.players.clear();
    timerInfo.style.display = state.timeLimitMs ? 'block' : 'none';
    timerInfo.textContent = state.timeLimitMs ? '⏱ ' + timerSeconds + ':00' : '';
    document.getElementById('gameOverOverlay').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('landingScreen').style.display = 'none';
    updatePlayLayout(playSessionEl);
    setPlaySessionActive(playSessionEl, true);
    setGameHudVisible(uiEl, true);

    loadMapById(state.selectedMapId, function(){
      if(state.isMultiplayer && !state.mpIsHost){
        state.dots = [];
        state.field = Array.from({ length: state.WIDTH }, () => Array(state.HEIGHT).fill(null));
        state.players = [];
        const humanSet = humanTeams instanceof Set
          ? humanTeams
          : new Set(Array.isArray(humanTeams) ? humanTeams : [team]);
        const XDIS = 40;
        const YDIS = 40;
        const startPos = [
          { x: XDIS, y: state.HEIGHT - YDIS },
          { x: XDIS, y: YDIS },
          { x: Math.floor(state.WIDTH / 2), y: state.HEIGHT - YDIS },
          { x: Math.floor(state.WIDTH / 2), y: YDIS },
          { x: state.WIDTH - XDIS, y: state.HEIGHT - YDIS },
          { x: state.WIDTH - XDIS, y: YDIS }
        ];
        for(let t = 0; t < teams; t++){
          const p = startPos[t];
          state.players.push({ x: p.x, y: p.y, ai: !humanSet.has(t), target: null });
        }
        updateScoresUI();
      } else {
        init(size, team, humanTeams);
        broadcastGameStateIfHost(true);
      }
      state.running = true;
      state.pendingRestart = {
        size,
        team,
        timerSeconds,
        mapId: state.selectedMapId,
        expertMode: state.expertMode,
        isMultiplayer: state.isMultiplayer,
        humanTeams: Array.isArray(humanTeams) ? humanTeams.slice() : Array.from(humanTeams)
      };
      requestAnimationFrame(function(){
        updatePlayLayout(playSessionEl);
        resize(canvas);
      });
    });
    return true;
  }

  function startGame(){
    beginMatch();
  }

  function startMultiplayerGame(gameState){
    if(!gameState) return;
    const team = typeof gameState.myTeam === 'number'
      ? gameState.myTeam
      : state.selectedTeam;
    beginMatch({
      teamSize: gameState.teamSize,
      mapId: gameState.selectedMapId,
      timerSeconds: gameState.timerSeconds,
      team,
      humanTeams: gameState.humanTeams || [team],
      isMultiplayer: true
    });
  }

  function countAliveTeams(){
    const alive = [];
    for(let t = 0; t < teams; t++){
      if(state.dots.some(d => d.team === t)) alive.push(t);
    }
    return alive;
  }

  function getTeamWithMostDots(){
    let bestTeam = -1;
    let bestCount = -1;
    let tied = false;
    for(let t = 0; t < teams; t++){
      const count = state.dots.filter(d => d.team === t).length;
      if(count > bestCount){
        bestCount = count;
        bestTeam = t;
        tied = false;
      } else if(count === bestCount) {
        tied = true;
      }
    }
    return tied ? -1 : bestTeam;
  }

  function endGame(won, title, message, options){
    if(state.gameOver) return;
    state.gameOver = true;
    state.running = false;
    state.paused = false;
    if(!options?.silent) playOutcomeSound(!!won);
    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverOverlay').style.display = 'flex';
  }

  function endMatchFromNetwork(result){
    if(state.gameOver || !result) return;
    const winner = typeof result.winnerTeam === 'number' ? result.winnerTeam : -1;
    const won = winner === state.selectedTeam;
    endGame(
      won,
      won ? 'VICTORY' : 'DEFEAT',
      won
        ? 'Your team has eliminated all opposition and stands supreme.'
        : 'Another team has eliminated all opposition and stands supreme.',
      { silent: state.mpIsHost }
    );
  }

  function step(){
    state.frameCounter++;
    return Movement.step(makeContext());
  }

  function applyMpCorrections(){
    // reconcile dot positions smoothly for non-host clients
    if(!state.dots) return;
    // dots
    for(const [idx, corr] of Array.from(mpCorrections.dots.entries())){
      const d = state.dots[idx];
      if(!d){
        mpCorrections.dots.delete(idx);
        continue;
      }
      const dx = corr.x - d.x;
      const dy = corr.y - d.y;
      if(dx === 0 && dy === 0 && d.team === corr.team && d.health === corr.health){
        mpCorrections.dots.delete(idx);
        continue;
      }
      d.x += Math.sign(dx) * (Math.abs(dx) > 1 ? 1 : Math.abs(dx));
      d.y += Math.sign(dy) * (Math.abs(dy) > 1 ? 1 : Math.abs(dy));
      d.team = corr.team;
      d.health = corr.health;
      if(d.x >= 0 && d.x < state.WIDTH && d.y >= 0 && d.y < state.HEIGHT){
        state.field[d.x][d.y] = d;
      }
      corr.ticks--;
      if(corr.ticks <= 0){
        mpCorrections.dots.delete(idx);
      }
    }

    // players
    for(const [team, corr] of Array.from(mpCorrections.players.entries())){
      const p = state.players[team];
      if(!p){
        mpCorrections.players.delete(team);
        continue;
      }
      const dx = corr.x - p.x;
      const dy = corr.y - p.y;
      p.x += Math.sign(dx) * (Math.abs(dx) > 1 ? 1 : Math.abs(dx));
      p.y += Math.sign(dy) * (Math.abs(dy) > 1 ? 1 : Math.abs(dy));
      corr.ticks--;
      if(corr.ticks <= 0) mpCorrections.players.delete(team);
    }
  }

  function simulateTick(){
    step();
    runAiCommanders();
    if(!state.mpIsHost) applyMpCorrections();
    checkMatchEnd();
    broadcastGameStateIfHost();
  }

  function updateTimer(nowMs){
    const timerInfo = document.getElementById('timerInfo');
    if(!state.timeLimitMs) {
      timerInfo.style.display = 'none';
      timerInfo.textContent = '';
      return;
    }
    timerInfo.style.display = 'block';
    if(state.gameOver) {
      timerInfo.textContent = '⏱ 0:00';
      return;
    }
    const remainingMs = Math.max(0, state.timeLimitMs - (nowMs - state.gameStartMs));
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    timerInfo.textContent = '⏱ ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    if(remainingMs <= 0 && playSessionEl && playSessionEl.classList.contains('is-active')){
      const winner = getTeamWithMostDots();
      const won = winner === state.selectedTeam;
      if(winner === -1){
        endGame(false, 'DEFEAT', 'Time expired before your team could secure the lead.');
      } else {
        endGame(
          won,
          won ? 'VICTORY' : 'DEFEAT',
          won
            ? 'Your team controls the arena with the most units.'
            : 'Another team controls the arena with the most units.'
        );
      }
      if(state.isMultiplayer && state.mpIsHost){
        getMpClient()?.endGame({ winnerTeam: winner }).catch(() => {});
      }
    }
  }

  function runAiCommanders(){
    for(let i = 0; i < teams; i++){
      if(i === state.selectedTeam) continue;
      const p = state.players[i];
      if(!p.ai) continue;
      if(!p.target || (state.frameCounter % 30) === 0 || Math.random() < 0.02) {
        p.target = getNearestDot(i, p.x, p.y);
      }
      if(p.target){
        p.x += Math.sign(p.target.x - p.x) * (Math.random() < 0.6 ? 1 : 0);
        p.y += Math.sign(p.target.y - p.y) * (Math.random() < 0.6 ? 1 : 0);
      }
    }
  }

  function checkMatchEnd(){
    const aliveTeams = countAliveTeams();
    if(aliveTeams.length !== 1) return;
    const won = aliveTeams[0] === state.selectedTeam;
    const title = won ? 'VICTORY' : 'DEFEAT';
    const message = won
      ? 'Your team has eliminated all opposition and stands supreme.'
      : 'Another team has eliminated all opposition and stands supreme.';
    endGame(won, title, message);
    if(state.mpIsHost){
      getMpClient()?.endGame({ winnerTeam: aliveTeams[0] }).catch(() => {});
    }
  }

  function loop(nowMs){
    if(!state.lastFrameMs) state.lastFrameMs = nowMs;
    if(state.running && !state.paused && !state.gameOver){
      // run local simulation on all clients to reduce perceived lag
      const hostSim = true;
      const clientReady = !state.isMultiplayer || !state.mpAwaitingState;
      const elapsedMs = Math.min(250, Math.max(0, nowMs - state.lastFrameMs));
      state.lastFrameMs = nowMs;

      if(hostSim){
        simulationAccumulatorMs += elapsedMs;
        let ticks = 0;
        while(simulationAccumulatorMs >= TARGET_TICK_MS && ticks < MAX_TICKS_PER_FRAME){
          simulationAccumulatorMs -= TARGET_TICK_MS;
          simulateTick();
          ticks++;
        }
        if(ticks === MAX_TICKS_PER_FRAME){
          simulationAccumulatorMs = 0;
        }
      }

      if(clientReady){
        draw(canvas, ctx, state);
      }
    }
    updateTimer(nowMs || performance.now());
    requestAnimationFrame(loop);
  }

  function returnToMenu(){
    const wasMultiplayer = state.isMultiplayer;
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.timeLimitMs = 0;
    state.isMultiplayer = false;
    state.mpIsHost = false;
    state.mpAwaitingState = false;
    mpHostLastPackedDots = null;
    mpHostLastFrame = 0;
    mpHostSnapshotSendCount = 0;
    mpClientLastPackedDots = null;
    mpClientLastFrame = 0;
    mpCorrections.dots.clear();
    mpCorrections.players.clear();
    setExpertMode(false);
    document.getElementById('gameOverOverlay').style.display = 'none';
    setPlaySessionActive(playSessionEl, false);
    setGameHudVisible(uiEl, false);
    if(wasMultiplayer && deps.onMultiplayerQuit){
      deps.onMultiplayerQuit();
    } else {
      document.getElementById('landingScreen').style.display = 'none';
      document.getElementById('startScreen').style.display = 'flex';
    }
  }

  function applyPendingRestart(){
    if(!state.pendingRestart) return;
    document.getElementById('teamSize').value = state.pendingRestart.size;
    document.getElementById('gameTimer').value = state.pendingRestart.timerSeconds;
    setExpertMode(state.pendingRestart.expertMode);
  }

  function setupStartScreen(){
    const mainUI = deps.initMainUI({
      teamNames: teamNames,
      colours: colours,
      MAP_COUNT: deps.MAP_COUNT,
      RANDOM_MAP_ID: RANDOM_MAP_ID,
      CUSTOM_MAP_ID: CUSTOM_MAP_ID,
      onStart: function(){ startGame(); },
      onTeamSelect: function(team){ state.selectedTeam = team; },
      onSizeOverride: function(){ setExpertMode(!state.expertMode); },
      onMapSelect: function(mapId){
        state.selectedMapId = mapId;
        refreshMapPreview(state.selectedMapId);
      },
      onCustomFilesChanged: function(){ syncCustomMapFiles(); }
    });

    if(mainUI){
      state.teamSizeInput = mainUI.teamSizeInput || state.teamSizeInput;
      state.sizeOverrideBtn = mainUI.sizeOverrideBtn || state.sizeOverrideBtn;
      state.mapPreview = mainUI.mapPreview || state.mapPreview;
      state.customMapPanel = mainUI.customMapPanel || state.customMapPanel;
      state.customCollisionInput = mainUI.customCollisionInput || state.customCollisionInput;
      state.customDisplayInput = mainUI.customDisplayInput || state.customDisplayInput;
      state.customMapStatus = mainUI.customMapStatus || state.customMapStatus;
    }

    state.selectedTeam = 0;
    setExpertMode(false);
    syncCustomMapFiles();
    refreshMapPreview(state.selectedMapId);
  }

  function initPlayControls(){
    deps.initPlayControls({
      isGameplayActive: function(){ return state.running; },
      onPauseStateChange: function(p){
        // Multiplayer: overlay only - match keeps simulating so clients stay in sync.
        if(!state.isMultiplayer) state.paused = !!p;
      },
      onResume: function(){
        if(!state.isMultiplayer) state.paused = false;
      },
      onRestart: function(){
        applyPendingRestart();
        startGame();
      },
      onQuit: returnToMenu,
      onGameOverRestart: function(){
        if(state.pendingRestart){
          document.getElementById('teamSize').value = state.pendingRestart.size;
          document.getElementById('gameTimer').value = state.pendingRestart.timerSeconds;
        }
        startGame();
      },
      onGameOverQuit: returnToMenu,
      onLayoutChanged: function(){
        updatePlayLayout(playSessionEl);
        requestAnimationFrame(function(){ resize(canvas); });
      }
    });
  }

  return {
    startGame,
    startMultiplayerGame,
    beginMatch,
    setupStartScreen,
    initPlayControls,
    loop,
    refreshMapPreview,
    applyRemoteGameState,
    forceBroadcastStateFull,
    applyRemotePlayerPosition,
    applyHostPlayerPosition,
    endMatchFromNetwork,
    getState: () => state
  };
}
