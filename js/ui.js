// UI overlay helpers
export function initUIOverlays(){
  const creditsBtn = document.getElementById('creditsBtn');
  const creditsOverlay = document.getElementById('creditsOverlay');
  const closeCreditsBtn = document.getElementById('closeCreditsBtn');
  const howToPlayBtn = document.getElementById('howToPlayBtn');
  const howToPlayOverlay = document.getElementById('howToPlayOverlay');
  const closeHowToPlayBtn = document.getElementById('closeHowToPlayBtn');
  const customMapGuideBtn = document.getElementById('customMapGuideBtn');
  const customMapGuideOverlay = document.getElementById('customMapGuideOverlay');
  const closeCustomMapGuideBtn = document.getElementById('closeCustomMapGuideBtn');

  if(!creditsOverlay && !howToPlayOverlay && !customMapGuideOverlay){
    return;
  }

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

  function isOverlayOpen(overlay){
    return !!overlay && overlay.style.display === 'flex';
  }

  function showCredits(){ showOverlay(creditsOverlay); }
  function hideCredits(){ hideOverlay(creditsOverlay); }
  function showHowToPlay(){ showOverlay(howToPlayOverlay); }
  function hideHowToPlay(){ hideOverlay(howToPlayOverlay); }
  function showCustomMapGuide(){ showOverlay(customMapGuideOverlay); }
  function hideCustomMapGuide(){ hideOverlay(customMapGuideOverlay); }

  if(creditsBtn) creditsBtn.addEventListener('click', showCredits);
  if(closeCreditsBtn) closeCreditsBtn.addEventListener('click', hideCredits);
  // Do not close overlays when clicking the backdrop. Keep explicit close buttons only.
  if(howToPlayBtn) howToPlayBtn.addEventListener('click', showHowToPlay);
  if(closeHowToPlayBtn) closeHowToPlayBtn.addEventListener('click', hideHowToPlay);
  if(customMapGuideBtn) customMapGuideBtn.addEventListener('click', showCustomMapGuide);
  if(closeCustomMapGuideBtn) closeCustomMapGuideBtn.addEventListener('click', hideCustomMapGuide);

  document.addEventListener('keydown', function(event){
    if(event.key !== 'Escape') return;
    if(isOverlayOpen(creditsOverlay)) hideCredits();
    if(isOverlayOpen(howToPlayOverlay)) hideHowToPlay();
    if(isOverlayOpen(customMapGuideOverlay)) hideCustomMapGuide();
  });
}

export function initMainUI(callbacks){
  const dropdown = document.getElementById('teamDropdown');
  const teamSizeInput = document.getElementById('teamSize');
  const sizeOverrideBtn = document.getElementById('sizeOverrideBtn');
  const mapDropdown = document.getElementById('mapDropdown');
  const mapPreview = document.getElementById('mapPreview');
  const customMapPanel = document.getElementById('customMapPanel');
  const customCollisionInput = document.getElementById('customCollisionMap');
  const customDisplayInput = document.getElementById('customDisplayMap');
  const customMapStatus = document.getElementById('customMapStatus');

  // team dropdown
  if(dropdown){
    dropdown.innerHTML = '';
    if(callbacks && callbacks.teamNames){
      for(let t=0;t<callbacks.teamNames.length;t++){
        const option = document.createElement('option');
        option.value = t;
        option.textContent = callbacks.teamNames[t];
        if(callbacks.colours) option.style.color = callbacks.colours[t];
        dropdown.appendChild(option);
      }
    }
    dropdown.addEventListener('change', function(){ if(callbacks && typeof callbacks.onTeamSelect === 'function') callbacks.onTeamSelect(parseInt(this.value,10)); });
  }

  if(sizeOverrideBtn){
    sizeOverrideBtn.addEventListener('click', function(){ if(callbacks && typeof callbacks.onSizeOverride === 'function') callbacks.onSizeOverride(); });
  }

  if(mapDropdown){
    mapDropdown.innerHTML = '';
    const RANDOM_MAP_ID = (callbacks && typeof callbacks.RANDOM_MAP_ID !== 'undefined') ? callbacks.RANDOM_MAP_ID : -1;
    const CUSTOM_MAP_ID = (callbacks && typeof callbacks.CUSTOM_MAP_ID !== 'undefined') ? callbacks.CUSTOM_MAP_ID : 46;
    const MAP_COUNT = (callbacks && typeof callbacks.MAP_COUNT !== 'undefined') ? callbacks.MAP_COUNT : 46;
    const randomOption = document.createElement('option');
    randomOption.value = RANDOM_MAP_ID;
    randomOption.textContent = 'Random';
    mapDropdown.appendChild(randomOption);
    for(let i = 0; i < MAP_COUNT; i++){
      const option = document.createElement('option');
      option.value = i;
      option.textContent = 'Map ' + (i + 1);
      mapDropdown.appendChild(option);
    }
    const customOption = document.createElement('option');
    customOption.value = CUSTOM_MAP_ID;
    customOption.textContent = 'Custom Map';
    mapDropdown.appendChild(customOption);
    mapDropdown.value = RANDOM_MAP_ID;
    mapDropdown.addEventListener('change', function(){
      const selectedMapId = parseInt(this.value, 10);
      if(customMapPanel) customMapPanel.hidden = selectedMapId !== CUSTOM_MAP_ID;
      if(callbacks && typeof callbacks.onMapSelect === 'function') callbacks.onMapSelect(selectedMapId);
    });
    if(customMapPanel) customMapPanel.hidden = true;
    if(customCollisionInput) customCollisionInput.addEventListener('change', function(){ if(callbacks && typeof callbacks.onCustomFilesChanged === 'function') callbacks.onCustomFilesChanged(); });
    if(customDisplayInput) customDisplayInput.addEventListener('change', function(){ if(callbacks && typeof callbacks.onCustomFilesChanged === 'function') callbacks.onCustomFilesChanged(); });
  }

  const startBtn = document.getElementById('startBtn');
  if(startBtn) startBtn.addEventListener('click', function(){
    const size = teamSizeInput ? parseInt(teamSizeInput.value,10)||400 : 400;
    const team = dropdown ? parseInt(dropdown.value,10)||0 : 0;
    if(callbacks && typeof callbacks.onStart === 'function') callbacks.onStart(size, team);
  });

  return {
    teamDropdown: dropdown,
    teamSizeInput: teamSizeInput,
    sizeOverrideBtn: sizeOverrideBtn,
    mapDropdown: mapDropdown,
    mapPreview: mapPreview,
    customMapPanel: customMapPanel,
    customCollisionInput: customCollisionInput,
    customDisplayInput: customDisplayInput,
    customMapStatus: customMapStatus
  };
}

export function updateScoresUI(dots, teams, teamNames, colours, teamSize){
  const scoreDiv = document.getElementById('scores');
  if(!scoreDiv) return;
  // Avoid rebuilding the scoreboard DOM on every network update (causes flashing).
  // If the scoreboard is already initialised with the correct number of team columns,
  // just update colours/titles and return. Otherwise build it.
  const existingCols = scoreDiv.querySelectorAll('.teamHudCol');
  if(existingCols.length === teams){
    for(let t = 0; t < teams; t++){
      const sFill = document.getElementById('score-' + t);
      if(sFill){
        sFill.style.background = colours && colours[t] ? colours[t] : '#888';
      }
      const col = existingCols[t];
      if(col){
        col.title = (teamNames && teamNames[t] ? teamNames[t] : ('Team ' + t)) + ' - share of all units on the map';
      }
    }
    return;
  }

  scoreDiv.innerHTML = '';
  for(let t = 0; t < teams; t++){
    const sWrap = document.createElement('div');
    sWrap.className = 'teamHudCol';
    sWrap.title = (teamNames && teamNames[t] ? teamNames[t] : ('Team ' + t)) + ' - share of all units on the map';
    const sBar = document.createElement('div');
    sBar.className = 'scoreBar';
    const sFill = document.createElement('div');
    sFill.className = 'scoreFill';
    sFill.id = 'score-' + t;
    sFill.style.background = colours && colours[t] ? colours[t] : '#888';
    sFill.style.height = '0%';
    sBar.appendChild(sFill);
    sWrap.appendChild(sBar);
    scoreDiv.appendChild(sWrap);
  }
}

export function initPlayControls(callbacks){
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const restartBtn = document.getElementById('restartBtn');
  const quitBtn = document.getElementById('quitBtn');
  const pauseFullscreenBtn = document.getElementById('pauseFullscreenBtn');
  const startFullscreenBtn = document.getElementById('startFullscreen');

  function isFullscreen(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  }

  function updateFullscreenLabels(){
    const label = isFullscreen() ? 'Exit Fullscreen' : 'Enter Fullscreen';
    if(pauseFullscreenBtn) pauseFullscreenBtn.textContent = label;
    if(startFullscreenBtn) startFullscreenBtn.textContent = label;
  }

  function toggleFullscreen(){
    if(isFullscreen()){
      if(document.exitFullscreen) document.exitFullscreen();
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      const el = document.documentElement;
      if(el.requestFullscreen) el.requestFullscreen();
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if(el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if(el.msRequestFullscreen) el.msRequestFullscreen();
    }
  }

  function onFullscreenLayout(){
    updateFullscreenLabels();
    if(callbacks && typeof callbacks.onLayoutChanged === 'function') callbacks.onLayoutChanged();
  }

  document.addEventListener('fullscreenchange', onFullscreenLayout);
  document.addEventListener('webkitfullscreenchange', onFullscreenLayout);
  document.addEventListener('mozfullscreenchange', onFullscreenLayout);
  document.addEventListener('MSFullscreenChange', onFullscreenLayout);

  if(startFullscreenBtn) startFullscreenBtn.addEventListener('click', function(){ toggleFullscreen(); updateFullscreenLabels(); });
  if(pauseFullscreenBtn) pauseFullscreenBtn.addEventListener('click', function(){ toggleFullscreen(); updateFullscreenLabels(); });

  function showPause(){
    pauseOverlay.style.display = 'flex';
    if(pauseBtn) pauseBtn.textContent = 'Resume Battle';
    if(callbacks && typeof callbacks.onPauseStateChange === 'function') callbacks.onPauseStateChange(true);
  }
  function hidePause(){
    pauseOverlay.style.display = 'none';
    if(pauseBtn) pauseBtn.textContent = 'Pause';
    if(callbacks && typeof callbacks.onPauseStateChange === 'function') callbacks.onPauseStateChange(false);
  }

  if(pauseBtn) pauseBtn.addEventListener('click', function(){
    if(!pauseOverlay) return;
    if(pauseOverlay.style.display === 'flex') hidePause(); else showPause();
  });

  if(resumeBtn) resumeBtn.addEventListener('click', function(){ hidePause(); if(callbacks && typeof callbacks.onResume === 'function') callbacks.onResume(); });

  if(restartBtn) restartBtn.addEventListener('click', function(){ hidePause(); if(callbacks && typeof callbacks.onRestart === 'function') callbacks.onRestart(); });

  if(quitBtn) quitBtn.addEventListener('click', function(){ hidePause(); if(callbacks && typeof callbacks.onQuit === 'function') callbacks.onQuit(); });

  const gameOverRestart = document.getElementById('gameOverRestartBtn');
  const gameOverQuit = document.getElementById('gameOverQuitBtn');
  if(gameOverRestart) gameOverRestart.addEventListener('click', function(){ document.getElementById('gameOverOverlay').style.display = 'none'; if(callbacks && typeof callbacks.onGameOverRestart === 'function') callbacks.onGameOverRestart(); });
  if(gameOverQuit) gameOverQuit.addEventListener('click', function(){ document.getElementById('gameOverOverlay').style.display = 'none'; if(callbacks && typeof callbacks.onGameOverQuit === 'function') callbacks.onGameOverQuit(); });

  // Toggle pause with Tab key (only during an active match)
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Tab') return;
    if(callbacks && typeof callbacks.isGameplayActive === 'function' && !callbacks.isGameplayActive()) return;
    e.preventDefault();
    if(!pauseOverlay) return;
    if(pauseOverlay.style.display === 'flex') hidePause(); else showPause();
  });
}
