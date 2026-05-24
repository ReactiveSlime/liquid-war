/* Server selector - fetches servers list and pings to find best connection */

export class ServerSelector {
  constructor() {
    this.servers = [];
    this.selectedServer = null;
    this.pingResults = new Map();
    this.customServer = null;
  }

  setCustomServer(url, name = 'Custom Server') {
    this.customServer = { url, name };
  }

  clearCustomServer() {
    this.customServer = null;
  }

  hasCustomServer() {
    return this.customServer !== null;
  }

  async loadServers(serversJsonUrl = 'https://liquid-war.reactivesli.me/servers.json') {
    try {
      const response = await fetch(serversJsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch servers list: ${response.status}`);
      }
      this.servers = (await response.json()).servers || [];
      return this.servers;
    } catch (error) {
      console.error('Error loading servers:', error);
      return [];
    }
  }

  async pingServer(url) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${url}/health`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors'
      });
      clearTimeout(timeoutId);
      const endTime = performance.now();
      return Math.round(endTime - startTime);
    } catch (error) {
      clearTimeout(timeoutId);
      return null; // Server unreachable
    }
  }

  async selectBestServer() {
    // If custom server is set, use it without pinging
    if (this.customServer) {
      this.selectedServer = this.customServer;
      console.log(`Using custom server: ${this.selectedServer.name}`);
      return this.selectedServer;
    }

    if (this.servers.length === 0) {
      console.warn('No servers loaded');
      return null;
    }

    console.log(`Pinging ${this.servers.length} server(s)...`);
    
    const pingPromises = this.servers.map(async (server) => {
      const ping = await this.pingServer(server.url);
      this.pingResults.set(server.url, ping);
      console.log(`${server.name}: ${ping ? ping + 'ms' : 'unreachable'}`);
      return { server, ping };
    });

    const results = await Promise.all(pingPromises);
    
    // Filter out unreachable servers and find the one with lowest ping
    const reachableServers = results.filter(r => r.ping !== null);
    
    if (reachableServers.length === 0) {
      console.error('All servers are unreachable');
      // Fall back to first server anyway
      this.selectedServer = this.servers[0];
      return this.selectedServer;
    }

    const best = reachableServers.reduce((lowest, current) => 
      current.ping < lowest.ping ? current : lowest
    );

    this.selectedServer = best.server;
    console.log(`Selected: ${this.selectedServer.name} (${best.ping}ms)`);
    
    return this.selectedServer;
  }

  getSelectedServer() {
    return this.selectedServer;
  }

  getSelectedServerName() {
    return this.selectedServer?.name || 'Unknown Server';
  }

  getSelectedServerUrl() {
    return this.selectedServer?.url || '';
  }

  getPingFor(url) {
    return this.pingResults.get(url);
  }
}
