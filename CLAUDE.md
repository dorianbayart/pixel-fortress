# Claude Code Assistant Context

This document provides context for Claude Code to effectively assist with the development of the "Pixel Fortress" game.

## Project Description

"Pixel Fortress" is a 2D real-time strategy (RTS) game built to run in a web browser. It is written entirely in vanilla JavaScript, using the PixiJS library for WebGL rendering on an HTML `<canvas>`. The game involves base building, resource gathering (wood, stone, water, gold), and automated unit combat against an AI opponent on a randomly generated map.

The project can run:
- Directly in a browser by opening `index.html` (landing page) or `play.html` (game)
- As a desktop application via Electron (`npm run start`)

## General Instructions

- The project uses vanilla JavaScript (ES6 Modules with `.mjs` extension). Do not introduce build tools, compilers (like TypeScript), or additional package managers without explicit instruction.
- All source code is organized into modules within the `js/` directory. Maintain this modular structure.
- The game is launched by opening `play.html` directly in a browser or via `npm run start` for Electron. The `index.html` file serves as the landing/marketing page.
- Run tests with `npm run test` before submitting changes.
- **IMPORTANT — Landing pages:** Never edit `index.html`, `fr/index.html`, `de/index.html`, or `es/index.html` directly. These are auto-generated from `index.template.html` + `locales/landing/*.json`. Always edit the template and/or locale data files, then rebuild with `node scripts/build-landing.js`.

## Coding Style & Conventions

- **Language:** Use modern JavaScript (ES6+), including `class`, `const`/`let`, and ES Modules (`import`/`export`).
- **File Extension:** All JavaScript modules use `.mjs` extension.
- **Formatting:** Follow the existing code style:
  - No semicolons at end of statements
  - Use single quotes for strings
  - Consistent indentation and spacing
- **Naming:**
  - Use `PascalCase` for class names (e.g., `CombatUnit`, `Player`, `GameState`).
  - Use `camelCase` for variables and functions (e.g., `gameLoop`, `updateVisibility`).
  - Use `UPPER_SNAKE_CASE` for constants (e.g., `TOP_BAR_HEIGHT`, `GAME_SPEED_MULTIPLIERS`).
- **Structure:** The code is heavily object-oriented, with clear class hierarchies for units and buildings. When adding new features, extend existing classes where appropriate.
- **State Management:** Use the centralized `GameState` class with its event system for state changes.

## Key Technologies

- **JavaScript (ES6 Modules)** - `.mjs` files
- **PixiJS** - 2D WebGL rendering
- **HTML5 Canvas**
- **Web Workers** - Pathfinding calculations
- **Electron** - Desktop application (optional)

## Important Files for Context

When making changes, refer to these core files to understand the game's architecture:

### Entry Points
- **`index.html`**: Landing/marketing page with project information and links.
- **`play.html`**: Game entry point. Contains the import map defining module paths, inline styles, and the game menu UI.
- **`js/index.mjs`**: JavaScript entry point that bootstraps the game.

### Core Game Logic
- **`js/game.mjs`**: Main game loop (`gameLoop`), map generation logic, and global game state management.
- **`js/state.mjs`**: Defines the `GameState` class and `EventSystem` - centralized state management with pub/sub pattern for state changes.
- **`js/init.mjs`**: Game initialization logic.

### Entities
- **`js/unit.mjs`**: Class hierarchy for all units (e.g., `Unit`, `WorkerUnit`, `CombatUnit`, `Mage`). Start here for unit-related changes.
- **`js/building.mjs`**: Class hierarchy for all buildings (e.g., `Building`, `Tent`, `Lumberjack`). Start here for building-related changes.
- **`js/players.mjs`**: Defines the `Player` class managing units, buildings, and resources for both human and AI players.

### Rendering & UI
- **`js/renderer.mjs`**: Handles all drawing operations via PixiJS.
- **`js/ui.mjs`**: Manages in-game UI elements including HUD, selection, and resource display.
- **`js/menu.mjs`**: Home menu and modal management.
- **`js/sprites.mjs`**: Sprite loading and management.
- **`js/particles.mjs`**: Particle effects system.

### Game Systems
- **`js/pathfinding.mjs`**: A* pathfinding algorithm for unit movement.
- **`js/fogOfWar.mjs`**: Fog of war visibility system.
- **`js/mouse.mjs`**: Mouse/touch input handling.
- **`js/viewport.mjs`**: Camera and viewport management.
- **`js/audio.mjs`**: Sound effects and music management.

### Configuration
- **`js/constants.mjs`**: Game constants (UI dimensions, speed multipliers).
- **`js/globals.mjs`**: Global variables and references.
- **`js/dimensions.mjs`**: Screen and map dimension calculations.

## File Structure Overview

```
/                   Root directory
├── index.html      Landing/marketing page
├── play.html       Game HTML entry point
├── main.js         Electron main process
├── sw.js           Service worker for PWA
├── manifest.json   PWA manifest
├── package.json    Node.js package config
│
├── js/             JavaScript source modules (.mjs files)
├── css/            Stylesheets
├── assets/         Static assets (sprites, fonts, sounds, music)
│   ├── buildings/  Building sprites
│   ├── units/      Unit sprites
│   ├── attacks/    Attack effect sprites
│   ├── ui/         UI elements
│   ├── sounds/     Sound effects
│   ├── music/      Background music
│   └── fonts/      Custom fonts
├── lib/            Third-party libraries (PixiJS)
├── maps/           Predefined map data (seeds.json)
├── plans/          Planning documents and roadmaps
├── tests/          Unit tests (.mjs files)
├── scripts/        Build/utility scripts
└── build/          Electron build configuration
```

## Directory Exclusions

- **`node_modules/`**: Standard npm dependencies for Electron. Do not modify.

## Game State Architecture

The game uses a centralized state management pattern:

```javascript
// Access game state
import gameState from 'state'

// Read state
gameState.humanPlayer
gameState.aiPlayers
gameState.gameStatus  // 'menu', 'initialize', 'playing', 'paused', 'gameOver', 'win'
gameState.settings

// Subscribe to state changes
gameState.events.on('game-status-changed', (status) => { /* handle */ })
gameState.events.on('settings-changed', ({ oldSettings, newSettings }) => { /* handle */ })
```

## Module Import Pattern

The project uses an import map defined in `play.html`:

```javascript
// Import by module name (resolved via import map)
import gameState from 'state'
import { Player } from 'players'
import { CombatUnit } from 'unit'
```

## Testing

Tests are located in the `tests/` directory and use `.mjs` extension:
- Run all tests: `npm run test`
- Test files follow the pattern `*.test.mjs`

## Known Issues

See `KNOWN_BUGS.md` for current known issues including:
- Building destruction sprite replacement
- Mobile UI responsiveness issues

## Planning Documents

The `plans/` directory contains strategic planning documents for major features and milestones:
- **`plans/ROADMAP.md`**: Development roadmap with planned features and their status
- **`plans/LICENSING_BUSINESS_MODEL.md`**: Open source licensing strategy and business model (freemium with feature flags)
- **`plans/STEAM_DEPLOYMENT.md`**: Comprehensive guide for Steam platform deployment

Key areas in progress:
- Sound effects and background music
- Game menu improvements
- AI opponent enhancements
- Steam deployment preparation

## License

This project is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**.

Key implications:
- All code is open source and must remain open source
- Derivative works must also be licensed under GPL v3
- Commercial use is permitted (including Steam distribution)
- Source code must be made available with any distribution
- When adding new code files, include the GPL v3 header comment (see existing files for examples)
