import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

function emitWithCallback(socket, event, ...args){
  return new Promise((resolve, reject) => {
    socket.emit(event, ...args, (response) => {
      if(response && response.success === false){
        reject(new Error(response.error || 'Request failed'));
        return;
      }
      resolve(response);
    });
  });
}

export class MultiplayerClient {
  constructor(serverUrl){
    this.serverUrl = serverUrl;
    this.socket = null;
    this.connected = false;
    this.roomId = null;
    this.isHost = false;
    this.playerName = '';
    this.myTeam = 0;
    this.players = [];
    this.settings = null;
    this._handlers = new Map();
  }

  on(event, handler){
    if(!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this._handlers.get(event)?.delete(handler);
  }

  _emitLocal(event, data){
    const handlers = this._handlers.get(event);
    if(!handlers) return;
    handlers.forEach((fn) => {
      try { fn(data); } catch(err) { console.error('[multiplayer]', event, err); }
    });
  }

  getState(){
    return {
      connected: this.connected,
      roomId: this.roomId,
      isHost: this.isHost,
      playerName: this.playerName,
      myTeam: this.myTeam,
      players: this.players,
      settings: this.settings
    };
  }

  connect(){
    if(this.socket?.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5
      });

      const onConnect = () => {
        this.connected = true;
        // expose socket id for UI logic
        this.myId = this.socket?.id || null;
        this._wireServerEvents();
        this._emitLocal('connected');
        cleanup();
        resolve();
      };

      const onError = (err) => {
        cleanup();
        reject(err || new Error('Could not connect to multiplayer server'));
      };

      const cleanup = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };

      this.socket.on('connect', onConnect);
      this.socket.on('connect_error', onError);
      // keep myId in sync on reconnects/disconnects
      this.socket.on('disconnect', () => { this.connected = false; this.myId = null; this._emitLocal('disconnected'); });
    });
  }

  _wireServerEvents(){
    if(this.socket._mpWired) return;
    this.socket._mpWired = true;

    this.socket.on('player-joined', (data) => {
      this.players = data.players || [];
      this._emitLocal('player-joined', data);
      this._emitLocal('players-updated', this.players);
    });

    this.socket.on('players-updated', (players) => {
      this.players = players || [];
      this._emitLocal('players-updated', this.players);
    });

    this.socket.on('player-left', (name) => {
      this._emitLocal('player-left', name);
    });

    this.socket.on('settings-updated', (settings) => {
      this.settings = settings;
      this._emitLocal('settings-updated', settings);
    });

    this.socket.on('custom-map-synced', (mapData) => {
      this.settings = {
        ...this.settings,
        customMapCollisionUrl: mapData.collisionUrl,
        customMapDisplayUrl: mapData.displayUrl
      };
      this._emitLocal('custom-map-synced', mapData);
    });

    this.socket.on('game-started', (gameState) => {
      this._emitLocal('game-started', gameState);
    });

    this.socket.on('game-state-update', (payload) => {
      this._emitLocal('game-state-update', payload);
    });

    this.socket.on('request-full-state', () => {
      this._emitLocal('request-full-state');
    });

    this.socket.on('snapshot-ack', (payload) => {
      this._emitLocal('snapshot-ack', payload);
    });

    this.socket.on('player-position', (payload) => {
      this._emitLocal('player-position', payload);
    });

    this.socket.on('game-ended', (result) => {
      this._emitLocal('game-ended', result);
    });

    this.socket.on('kicked', (data) => {
      this._emitLocal('kicked', data);
    });

    this.socket.on('room-closed', (reason) => {
      this._resetRoom();
      this._emitLocal('room-closed', reason);
    });
  }

  _resetRoom(){
    this.roomId = null;
    this.isHost = false;
    this.players = [];
    this.settings = null;
    this.myTeam = 0;
  }

  async createRoom(playerName){
    await this.connect();
    const response = await emitWithCallback(this.socket, 'create-room', playerName);
    this.roomId = response.roomId;
    this.isHost = true;
    this.playerName = playerName;
    this.players = response.room.players;
    this.settings = response.room.settings;
    this.myTeam = 0;
    return response;
  }

  async joinRoom(roomId, playerName){
    await this.connect();
    const response = await emitWithCallback(this.socket, 'join-room', roomId, playerName);
    this.roomId = response.roomId;
    this.isHost = false;
    this.playerName = playerName;
    this.players = response.room.players;
    this.settings = response.room.settings;
    this.myTeam = response.yourTeam;
    return response;
  }

  async updateSettings(newSettings){
    if(!this.isHost) throw new Error('Only the host can change settings');
    const response = await emitWithCallback(this.socket, 'update-settings', newSettings);
    this.settings = response.settings;
    return response.settings;
  }

  async syncCustomMap(collisionUrl, displayUrl){
    if(!this.isHost) throw new Error('Only the host can sync custom maps');
    return emitWithCallback(this.socket, 'sync-custom-map', {
      collisionUrl,
      displayUrl: displayUrl || null
    });
  }

  async setReady(ready){
    return emitWithCallback(this.socket, 'player-ready', !!ready);
  }

  async startGame(gameSettings){
    if(!this.isHost) throw new Error('Only the host can start the game');
    return emitWithCallback(this.socket, 'start-game', gameSettings);
  }

  async kickPlayer(playerId){
    if(!this.isHost) throw new Error('Only the host can kick players');
    return emitWithCallback(this.socket, 'kick-player', playerId);
  }

  getSocketId(){
    return this.socket?.id || null;
  }

  sendPlayerPosition(position){
    if(!this.socket?.connected || !this.roomId) return;
    this.socket.emit('player-position', position);
  }

  sendGameState(stateUpdate){
    if(!this.socket?.connected || !this.roomId || !this.isHost) return;
    this.socket.emit('game-state-update', stateUpdate);
  }

  sendSnapshotAck(frame){
    if(!this.socket?.connected || !this.roomId || this.isHost) return;
    this.socket.emit('snapshot-ack', { frame });
  }

  requestFullState(){
    if(!this.socket?.connected || !this.roomId || this.isHost) return;
    this.socket.emit('request-full-state');
  }

  async endGame(gameResult){
    if(!this.isHost) throw new Error('Only the host can end the game');
    return emitWithCallback(this.socket, 'end-game', gameResult);
  }

  async returnToMenu(){
    if(!this.socket?.connected) return;
    this.socket.emit('return-to-menu');
  }

  leaveRoom(){
    if(this.socket){
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this._resetRoom();
  }

  async reconnect(){
    this.leaveRoom();
    await this.connect();
  }
}

export async function fileToDataUrl(file){
  if(!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
