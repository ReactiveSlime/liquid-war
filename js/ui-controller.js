import { CUSTOM_MAP_ID, RANDOM_MAP_ID } from './config.js';

// Menu and lobby controller moved out of app.js to keep responsibilities clear.
export function initMenu(options){
  const {
    state,
    makeContextBase,
    game,
    mpClient,
    initMainUI,
    initMultiplayerUI,
    clearCustomMapUrls,
    serverName
  } = options;

  let mpUi = null;
  let toastTimer = null;
  const customServerToggleBtn = document.getElementById('customServerToggleBtn');
  const customServerPanel = document.getElementById('customServerPanel');
  const customServerUrl = document.getElementById('customServerUrl');
  const customServerConnectBtn = document.getElementById('customServerConnectBtn');
  const customServerCancelBtn = document.getElementById('customServerCancelBtn');

  function showToast(message, isError){
    const el = document.getElementById('mpToast');
    if(!el) return;
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function showCustomServerPanel(show){
    if(customServerPanel) customServerPanel.hidden = !show;
    if(show) customServerUrl?.focus();
  }

  async function handleCustomServerInput(){
    const url = customServerUrl?.value?.trim();
    if(!url) {
      showToast('Enter a server URL first.', true);
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      showToast('Invalid server URL', true);
      return;
    }

    const serverName = parsedUrl.hostname || 'Custom Server';
    const selector = mpClient.serverSelector;
    if(!selector) {
      showToast('Server selector is not ready.', true);
      return;
    }

    const previousServerUrl = mpClient.serverUrl;
    selector.setCustomServer(parsedUrl.toString(), serverName);
    mpClient.serverUrl = parsedUrl.toString();

    try {
      mpUi?.setConnectionStatus(`Connecting to: ${serverName}...`);
      await mpClient.reconnect();
      mpUi?.setConnectionStatus(`Connected to: ${serverName}`);
      showCustomServerPanel(false);
      showToast(`Connected to ${serverName}`, false);
    } catch (error) {
      selector.clearCustomServer();
      mpClient.serverUrl = previousServerUrl;
      mpUi?.setConnectionStatus(`Could not connect to: ${serverName}`, true);
      showToast(error?.message || 'Could not connect to the custom server.', true);
    }
  }

  function getSettingsFromDom(){
    const teamDropdown = document.getElementById('teamDropdown');
    const teamSizeInput = document.getElementById('teamSize');
    const mapDropdown = document.getElementById('mapDropdown');
    const gameTimer = document.getElementById('gameTimer');
    return {
      teamSize: parseInt(teamSizeInput?.value, 10) || 400,
      selectedMapId: mapDropdown ? parseInt(mapDropdown.value, 10) : RANDOM_MAP_ID,
      timerSeconds: parseInt(gameTimer?.value, 10) || 0,
      customMapCollisionUrl: state.customMapCollisionUrl || null,
      customMapDisplayUrl: state.customMapDisplayUrl || null
    };
  }

  function applySettingsToDom(settings){
    if(!settings) return;
    const teamSizeInput = document.getElementById('teamSize');
    const mapDropdown = document.getElementById('mapDropdown');
    const gameTimer = document.getElementById('gameTimer');
    const customMapPanel = document.getElementById('customMapPanel');

    if(teamSizeInput && settings.teamSize != null) teamSizeInput.value = settings.teamSize;
    if(gameTimer && settings.timerSeconds != null) gameTimer.value = settings.timerSeconds;
    if(mapDropdown && settings.selectedMapId != null){
      mapDropdown.value = String(settings.selectedMapId);
      if(customMapPanel) customMapPanel.hidden = settings.selectedMapId !== CUSTOM_MAP_ID;
      state.selectedMapId = settings.selectedMapId;
      game.refreshMapPreview(settings.selectedMapId);
    }
    if(settings.customMapCollisionUrl){
      applyCustomMapUrls(settings.customMapCollisionUrl, settings.customMapDisplayUrl);
    }
  }

  function applyCustomMapUrls(collisionUrl, displayUrl){
    const ctx = makeContextBase({ refreshMapPreview: game.refreshMapPreview });
    clearCustomMapUrls(ctx);
    if(collisionUrl){
      state.customMapCollisionUrl = collisionUrl;
      ctx.customMapCollisionUrl = collisionUrl;
    }
    if(displayUrl){
      state.customMapDisplayUrl = displayUrl;
      ctx.customMapDisplayUrl = displayUrl;
    }
    state.selectedMapId = CUSTOM_MAP_ID;
    const mapDropdown = document.getElementById('mapDropdown');
    const customMapPanel = document.getElementById('customMapPanel');
    if(mapDropdown) mapDropdown.value = String(CUSTOM_MAP_ID);
    if(customMapPanel) customMapPanel.hidden = false;
    game.refreshMapPreview(CUSTOM_MAP_ID);
  }

  mpUi = initMultiplayerUI({
    mpClient,
    getSettingsFromDom,
    applySettingsToDom,
    applyCustomMapUrls,
    onSinglePlayer(){
      const teamDropdown = document.getElementById('teamDropdown');
      if(teamDropdown) state.selectedTeam = parseInt(teamDropdown.value, 10) || 0;
    },
    onStartMultiplayerGame(gameState){
      if(gameState.customMapCollisionUrl){
        applyCustomMapUrls(gameState.customMapCollisionUrl, gameState.customMapDisplayUrl);
      }
      const payload = {
        ...gameState,
        myTeam: mpClient.myTeam,
        teamSize: gameState.teamSize ?? parseInt(document.getElementById('teamSize')?.value, 10),
        selectedMapId: gameState.selectedMapId ?? state.selectedMapId,
        timerSeconds: gameState.timerSeconds ?? parseInt(document.getElementById('gameTimer')?.value, 10),
        humanTeams: gameState.humanTeams || mpClient.players.map((p) => p.team)
      };
      game.startMultiplayerGame(payload);
    },
    onLeaveLobby(){
      state.isMultiplayer = false;
    },
    showToast
  });

  customServerToggleBtn?.addEventListener('click', () => {
    showCustomServerPanel(customServerPanel?.hidden !== false);
  });

  customServerConnectBtn?.addEventListener('click', handleCustomServerInput);

  customServerCancelBtn?.addEventListener('click', () => {
    if(customServerUrl) customServerUrl.value = '';
    showCustomServerPanel(false);
  });

  customServerUrl?.addEventListener('keydown', (event) => {
    if(event.key === 'Enter'){
      event.preventDefault();
      handleCustomServerInput();
    }
  });

  mpUi.showLanding();

  mpClient.connect()
    .then(() => mpUi.setConnectionStatus(`Connected to: ${serverName}`))
    .catch(() => mpUi.setConnectionStatus(`All multiplayer servers offline`, true));

  return mpUi;
}
