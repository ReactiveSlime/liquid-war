# Liquid War

Liquid War is a fast-paced browser strategy game where you steer a liquid-like swarm of units across the arena, capture territory, and overwhelm the enemy team.

## Features

- Single-player battles against the map and opposing teams.
- Multiplayer rooms with host/join flow and room IDs.
- Built-in map selection with preview.
- Custom map support using a collision image, or a collision image plus a separate display image.
- Pause, restart, fullscreen, and match timer options.
- Sound effects for menu navigation and match outcomes.

## How To Play

1. Open the game in a browser.
2. Choose Single Player or Multiplayer from the title screen.
3. Set your team, army size, timer, and map.
4. Start the battle and guide your commander with the mouse or touch input.
5. Win by converting enemy units and ending with the strongest force when the match ends.

## Controls

- Desktop: move the mouse to direct your army.
- Touch devices: drag your finger to steer.
- Use the pause button to resume, restart, or quit to the menu.

## Running Locally

This project is a static site with ES modules, so it should be served over HTTP rather than opened directly with `file://`.

Any simple local web server works. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` and load `index.html`.

## Multiplayer

Multiplayer connects to a Liquid War server endpoint. The game loads the server list from `servers.json` and automatically picks a server to connect to.

- Create a room to host a match.
- Share the room ID with other players.
- Join a room using the host's room ID.
- Use the custom server option if you want to point the game at another compatible server.

## Custom Maps

Custom maps are built from image files.

- Opaque pixels become walls.
- Transparent pixels stay open.
- You can use one image for both collision and display, or upload a collision image plus a separate display image.

See [custom-map-guide.html](custom-map-guide.html) for the full workflow.

## Help Pages

- [How to Play](how-to-play.html)
- [Custom Map Guide](custom-map-guide.html)
- [Credits](credits.html)

## Credits

Sources and inspirations behind this remake:

- Menu sound effect by [LIECIO](https://pixabay.com/users/liecio-3298866/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=190020) from [Pixabay](https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=190020)
- Win sound effect by [u_3bsnvt0dsu](https://pixabay.com/users/u_3bsnvt0dsu-48554563/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=295086) from [Pixabay](https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=295086)
- Lose sound effect by [u_8g40a9z0la](https://pixabay.com/users/u_8g40a9z0la-45586904/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=234710) from [Pixabay](https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=234710)
- Map and inspirations from [github.com/DerGoogler/liquid-wars](https://github.com/DerGoogler/liquid-wars)

The rest of the interface, assets, and implementation are part of this remake.

## Project Structure

- `index.html` - main game shell and menus
- `css/` - styling
- `js/` - game logic, UI, rendering, multiplayer, and input handling
- `audio/` - sound effects
- `maps/` - built-in map assets

## Notes

- The game uses plain HTML, CSS, and JavaScript.
- There is no build step in this repository.
- Multiplayer depends on a compatible backend server.

