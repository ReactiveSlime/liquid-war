import { colours, teamNames, CUSTOM_MAP_ID, MAP_COUNT } from './config.js';
import { resolveMapId } from './map-normal.js';
import { fileToDataUrl } from './multiplayer.js';

export function initMultiplayerUI(options){
  const {
    mpClient,
    getSettingsFromDom,
    applySettingsToDom,
    applyCustomMapUrls,
    onSinglePlayer,
    onStartMultiplayerGame,
    onLeaveLobby,
    showToast
  } = options;

  const landingScreen = document.getElementById('landingScreen');
  const startScreen = document.getElementById('startScreen');
  const multiplayerLobby = document.getElementById('multiplayerLobby');
  const singlePlayerActions = document.getElementById('singlePlayerActions');
  const menuTitle = document.getElementById('menuTitle');
  const mpConnectionStatus = document.getElementById('mpConnectionStatus');

  const modeSelectorOverlay = document.getElementById('modeSelectorOverlay');
  const createRoomOverlay = document.getElementById('createRoomOverlay');
  const joinRoomOverlay = document.getElementById('joinRoomOverlay');

  const singlePlayerBtn = document.getElementById('singlePlayerBtn');
  const multiplayerBtn = document.getElementById('multiplayerBtn');
  const mpCreateRoomBtn = document.getElementById('mpCreateRoomBtn');
  const mpJoinRoomBtn = document.getElementById('mpJoinRoomBtn');
  const mpModeBackBtn = document.getElementById('mpModeBackBtn');

  const hostNameInput = document.getElementById('hostNameInput');
  const createRoomConfirmBtn = document.getElementById('createRoomConfirmBtn');
  const createRoomCancelBtn = document.getElementById('createRoomCancelBtn');
  const createRoomError = document.getElementById('createRoomError');

  const joinNameInput = document.getElementById('joinNameInput');
  const joinRoomIdInput = document.getElementById('joinRoomIdInput');
  const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');
  const joinRoomCancelBtn = document.getElementById('joinRoomCancelBtn');
  const joinRoomError = document.getElementById('joinRoomError');

  const roomIdDisplay = document.getElementById('roomIdDisplay');
  const playerCountEl = document.getElementById('playerCount');
  const playerListEl = document.getElementById('playerList');
  const lobbyReadyBtn = document.getElementById('lobbyReadyBtn');
  const lobbyStartBtn = document.getElementById('lobbyStartBtn');
  const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
  const backToLandingBtn = document.getElementById('backToLandingBtn');
  const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');

  const gamesettings = document.getElementById('gamesettings');
  let settingsSyncTimer = null;
  let isReady = false;

  function showOverlay(overlay){
    if(!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideOverlay(overlay){
    if(!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
  }

  function setConnectionStatus(text, isError){
    if(!mpConnectionStatus) return;
    mpConnectionStatus.textContent = text;
    mpConnectionStatus.classList.toggle('is-error', !!isError);
  }

  function setSettingsEditable(editable){
    const inputs = gamesettings?.querySelectorAll('input, select, button');
    inputs?.forEach((el) => {
      if(el.id === 'sizeOverrideBtn' || el.type === 'file'){
        el.disabled = !editable;
      } else if(el.tagName === 'INPUT' || el.tagName === 'SELECT'){
        el.disabled = !editable;
      }
    });
    if(gamesettings) gamesettings.classList.toggle('is-readonly', !editable);
  }

  function showLanding(){
    landingScreen.style.display = 'flex';
    startScreen.style.display = 'none';
    if(multiplayerLobby) multiplayerLobby.hidden = true;
    if(singlePlayerActions) singlePlayerActions.hidden = false;
    if(menuTitle) menuTitle.textContent = 'Liquid Wars';
    setSettingsEditable(true);
  }

  function showSinglePlayerMenu(){
    landingScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    if(multiplayerLobby) multiplayerLobby.hidden = true;
    if(singlePlayerActions) singlePlayerActions.hidden = false;
    if(menuTitle) menuTitle.textContent = 'Single Player';
    setSettingsEditable(true);
    const teamDropdown = document.getElementById('teamDropdown');
    if(teamDropdown) teamDropdown.disabled = false;
    onSinglePlayer?.();
  }

  function showMultiplayerLobby(){
    landingScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    if(multiplayerLobby) multiplayerLobby.hidden = false;
    if(singlePlayerActions) singlePlayerActions.hidden = true;
    if(menuTitle) menuTitle.textContent = mpClient.isHost ? 'Host Lobby' : 'Game Lobby';

    const editable = mpClient.isHost;
    setSettingsEditable(editable);
    if(lobbyStartBtn) lobbyStartBtn.hidden = !mpClient.isHost;
    // Host should still be able to mark themselves as ready; show the ready button for all clients
    if(lobbyReadyBtn) lobbyReadyBtn.hidden = false;
    if(copyRoomIdBtn) copyRoomIdBtn.hidden = !mpClient.isHost;

    const teamDropdown = document.getElementById('teamDropdown');
    const teamSelect = document.getElementById('teamSelect');
    if(teamDropdown){
      teamDropdown.value = String(mpClient.myTeam);
      teamDropdown.disabled = true;
    }
    if(teamSelect) teamSelect.style.opacity = editable ? '1' : '0.85';

    updateLobbyDisplay();
    if(mpClient.settings) applySettingsToDom(mpClient.settings);
  }

  function updateLobbyDisplay(){
    const count = mpClient.players?.length || 0;
    if(roomIdDisplay) roomIdDisplay.textContent = mpClient.roomId || '-';
    if(playerCountEl){
      playerCountEl.textContent = count + (count === 1 ? ' player' : ' players') + ' connected';
    }
    // Disable start button unless host AND all players are ready
    const playersList = mpClient.players || [];
    const allReady = playersList.length > 0 && playersList.every(p => p.ready);
    if(lobbyStartBtn) lobbyStartBtn.disabled = !(mpClient.isHost && allReady);
    // Update local ready UI state from server data
    const mySocketId = (typeof mpClient.getSocketId === 'function') ? mpClient.getSocketId() : (mpClient.myId || mpClient.socket?.id);
    if(mySocketId){
      const me = playersList.find(p => p.id === mySocketId);
      if(me) setReadyUi(!!me.ready);
    }
    renderPlayerList();
  }

  function renderPlayerList(){
    if(!playerListEl) return;
    playerListEl.innerHTML = '';
    (mpClient.players || []).forEach((player) => {
      const row = document.createElement('div');
      row.className = 'lobby-player';
      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = player.name + (player.team === mpClient.myTeam ? ' (you)' : '');
      const team = document.createElement('span');
      team.className = 'player-team';
      const colour = colours[player.team] || '#888';
      team.textContent = teamNames[player.team] || ('Team ' + player.team);
      team.style.borderLeft = '3px solid ' + colour;
      const ready = document.createElement('span');
      ready.className = 'player-ready ' + (player.ready ? 'ready' : 'not-ready');
      ready.textContent = player.ready ? '✓ Ready' : '⏳ Waiting';
      row.appendChild(name);
      row.appendChild(team);
      row.appendChild(ready);

      // If host, show a Kick button next to other players
      const amHost = !!mpClient.isHost;
      const mySocketId = (typeof mpClient.getSocketId === 'function') ? mpClient.getSocketId() : (mpClient.myId || mpClient.socket?.id);
      if (amHost && player.id && player.id !== mySocketId) {
        const kickBtn = document.createElement('button');
        kickBtn.className = 'secondaryBtn smallBtn kickBtn';
        kickBtn.textContent = 'Kick';
        kickBtn.addEventListener('click', async () => {
          try {
            if (mpClient.kickPlayer) {
              await mpClient.kickPlayer(player.id);
              showToast?.((player.name || 'Player') + ' was kicked');
            } else if (mpClient.socket && mpClient.socket.emit) {
              mpClient.socket.emit('kick-player', player.id, (res) => {
                if (!res || !res.success) {
                  showToast?.(res?.error || 'Failed to kick player', true);
                } else {
                  showToast?.((player.name || 'Player') + ' was kicked');
                }
              });
            }
          } catch (err) {
            showToast?.(err?.message || 'Failed to kick player', true);
          }
        });
        row.appendChild(kickBtn);
      }
      playerListEl.appendChild(row);
    });
  }

  function setReadyUi(ready){
    isReady = !!ready;
    if(!lobbyReadyBtn) return;
    lobbyReadyBtn.textContent = isReady ? '✓ Ready' : 'Mark as Ready';
    lobbyReadyBtn.classList.toggle('is-ready', isReady);
  }

  async function syncHostSettings(){
    if(!mpClient.isHost || !mpClient.roomId) return;
    const settings = getSettingsFromDom();
    try {
      await mpClient.updateSettings(settings);
    } catch(err) {
      console.warn('Settings sync failed:', err.message);
    }
  }

  function scheduleSettingsSync(){
    if(!mpClient.isHost) return;
    clearTimeout(settingsSyncTimer);
    settingsSyncTimer = setTimeout(syncHostSettings, 300);
  }

  async function syncHostCustomMap(){
    if(!mpClient.isHost) return;
    const settings = getSettingsFromDom();
    if(settings.selectedMapId !== CUSTOM_MAP_ID) return;

    const collisionInput = document.getElementById('customCollisionMap');
    const displayInput = document.getElementById('customDisplayMap');
    const collisionFile = collisionInput?.files?.[0];
    if(!collisionFile) return;

    try {
      const collisionUrl = await fileToDataUrl(collisionFile);
      const displayFile = displayInput?.files?.[0];
      const displayUrl = displayFile ? await fileToDataUrl(displayFile) : null;
      await mpClient.syncCustomMap(collisionUrl, displayUrl);
    } catch(err) {
      console.warn('Custom map sync failed:', err.message);
    }
  }

  function wireSettingsListeners(){
    gamesettings?.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('change', () => {
        scheduleSettingsSync();
        if(mpClient.isHost) syncHostCustomMap();
      });
    });
    document.getElementById('customCollisionMap')?.addEventListener('change', () => {
      scheduleSettingsSync();
      syncHostCustomMap();
    });
    document.getElementById('customDisplayMap')?.addEventListener('change', syncHostCustomMap);
    document.getElementById('sizeOverrideBtn')?.addEventListener('click', scheduleSettingsSync);
  }

  mpClient.on('players-updated', () => updateLobbyDisplay());
  mpClient.on('player-joined', () => {
    updateLobbyDisplay();
    showToast?.((mpClient.players?.slice(-1)[0]?.name || 'A player') + ' joined the room');
  });
  mpClient.on('player-left', (name) => {
    showToast?.((name || 'A player') + ' left the room');
  });
  mpClient.on('settings-updated', (settings) => {
    applySettingsToDom(settings);
  });
  mpClient.on('custom-map-synced', (mapData) => {
    applyCustomMapUrls(mapData.collisionUrl, mapData.displayUrl);
  });
  mpClient.on('game-started', (gameState) => {
    onStartMultiplayerGame?.(gameState);
  });
  mpClient.on('room-closed', (reason) => {
    showToast?.(reason || 'Room closed', true);
    exitLobby();
    showLanding();
  });

  mpClient.on('kicked', (data) => {
    showToast?.((data?.reason) ? ('Kicked: ' + data.reason) : 'You were kicked from the room', true);
    exitLobby();
    showLanding();
  });

  singlePlayerBtn?.addEventListener('click', showSinglePlayerMenu);

  multiplayerBtn?.addEventListener('click', () => {
    showOverlay(modeSelectorOverlay);
  });

  mpModeBackBtn?.addEventListener('click', () => hideOverlay(modeSelectorOverlay));
    // Do not close the mode selector when clicking the backdrop; require explicit action.

  mpCreateRoomBtn?.addEventListener('click', () => {
    hideOverlay(modeSelectorOverlay);
    if(createRoomError){
      createRoomError.textContent = '';
      createRoomError.hidden = true;
    }
    if(hostNameInput) hostNameInput.value = hostNameInput.value || 'Host';
    showOverlay(createRoomOverlay);
  });

  mpJoinRoomBtn?.addEventListener('click', () => {
    hideOverlay(modeSelectorOverlay);
    if(joinRoomError) joinRoomError.textContent = '';
    showOverlay(joinRoomOverlay);
  });

  createRoomCancelBtn?.addEventListener('click', () => hideOverlay(createRoomOverlay));
    // Backdrop clicks should not close the create-room dialog.

  joinRoomCancelBtn?.addEventListener('click', () => hideOverlay(joinRoomOverlay));
    // Backdrop clicks should not close the join-room dialog.

  createRoomConfirmBtn?.addEventListener('click', async () => {
    const name = (hostNameInput?.value || '').trim();
    if(!name){
      if(createRoomError){
        createRoomError.textContent = 'Enter your name to host a room.';
        createRoomError.hidden = false;
      }
      return;
    }
    createRoomConfirmBtn.disabled = true;
    if(createRoomError) createRoomError.hidden = true;
    try {
      await mpClient.createRoom(name);
      hideOverlay(createRoomOverlay);
      showMultiplayerLobby();
      await syncHostSettings();
    } catch(err) {
      if(createRoomError){
        createRoomError.textContent = err.message || 'Could not create room.';
        createRoomError.hidden = false;
      }
    } finally {
      createRoomConfirmBtn.disabled = false;
    }
  });

  joinRoomConfirmBtn?.addEventListener('click', async () => {
    const name = (joinNameInput?.value || '').trim();
    const roomId = (joinRoomIdInput?.value || '').trim();
    if(!name){
      if(joinRoomError){
        joinRoomError.textContent = 'Enter your name.';
        joinRoomError.hidden = false;
      }
      return;
    }
    if(!roomId){
      if(joinRoomError){
        joinRoomError.textContent = 'Enter the room ID from the host.';
        joinRoomError.hidden = false;
      }
      return;
    }
    joinRoomConfirmBtn.disabled = true;
    if(joinRoomError) joinRoomError.hidden = true;
    try {
      await mpClient.joinRoom(roomId, name);
      hideOverlay(joinRoomOverlay);
      showMultiplayerLobby();
    } catch(err) {
      if(joinRoomError){
        joinRoomError.textContent = err.message || 'Could not join room.';
        joinRoomError.hidden = false;
      }
    } finally {
      joinRoomConfirmBtn.disabled = false;
    }
  });

  copyRoomIdBtn?.addEventListener('click', async () => {
    if(!mpClient.roomId) return;
    try {
      await navigator.clipboard.writeText(mpClient.roomId);
      showToast?.('Room ID copied to clipboard');
    } catch {
      showToast?.('Room ID: ' + mpClient.roomId);
    }
  });

  lobbyReadyBtn?.addEventListener('click', async () => {
    try {
      const next = !isReady;
      await mpClient.setReady(next);
      setReadyUi(next);
    } catch(err) {
      showToast?.(err.message || 'Could not update ready status', true);
    }
  });

  lobbyStartBtn?.addEventListener('click', async () => {
    const settings = getSettingsFromDom();
    if(settings.selectedMapId === CUSTOM_MAP_ID && !settings.customMapCollisionUrl){
      showToast?.('Choose a collision image before starting.', true);
      return;
    }
    try {
      if(mpClient.isHost){
        await syncHostSettings();
        if(settings.selectedMapId === CUSTOM_MAP_ID){
          await syncHostCustomMap();
        }
      }
      const humanTeams = mpClient.players.map((p) => p.team);
      const selectedMapId = resolveMapId(settings.selectedMapId, MAP_COUNT);
      await mpClient.startGame({
        teamSize: settings.teamSize,
        selectedMapId,
        timerSeconds: settings.timerSeconds,
        customMapCollisionUrl: settings.customMapCollisionUrl,
        customMapDisplayUrl: settings.customMapDisplayUrl,
        humanTeams,
        players: mpClient.players
      });
    } catch(err) {
      showToast?.(err.message || 'Could not start game', true);
    }
  });

  function exitLobby(){
    isReady = false;
    setReadyUi(false);
    mpClient.leaveRoom();
    onLeaveLobby?.();
  }

  leaveLobbyBtn?.addEventListener('click', async () => {
    exitLobby();
    try { await mpClient.reconnect(); setConnectionStatus('Connected to multiplayer server'); }
    catch { setConnectionStatus('Multiplayer server offline - single player still works', true); }
    showLanding();
  });

  backToLandingBtn?.addEventListener('click', () => {
    showLanding();
  });

  wireSettingsListeners();

  return {
    showLanding,
    showSinglePlayerMenu,
    showMultiplayerLobby,
    setConnectionStatus,
    scheduleSettingsSync
  };
}
