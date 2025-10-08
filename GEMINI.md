# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to effectively assist with the development of the "Pixel Fortress" game.

## Project Description

"Pixel Fortress" is a 2D real-time strategy (RTS) game built to run in a web browser. It is written entirely in vanilla JavaScript, using the PixiJS library for WebGL rendering on an HTML `<canvas>`. The game involves base building, resource gathering (wood, stone, water, gold), and automated unit combat against an AI opponent on a randomly generated map.

The project is self-contained and has no external build dependencies (no npm, webpack, etc.).

## General Instructions

- The project uses vanilla JavaScript (ES6 Modules). Do not introduce any build tools, compilers (like TypeScript), or package managers (like npm) without explicit instruction.
- All code is organized into modules within the `js/` directory. Maintain this modular structure.
- The game is launched by opening the `index.html` file directly in a browser.

## Coding Style & Conventions

- **Language:** Use modern JavaScript (ES6+), including `class`, `const`/`let`, and ES Modules (`import`/`export`).
- **Formatting:** Follow the existing code style (indentation, spacing, brace style).
- **Naming:**
    - Use `PascalCase` for class names (e.g., `CombatUnit`, `Player`).
    - Use `camelCase` for variables and functions (e.g., `gameLoop`, `updateVisibility`).
    - Use `UPPER_SNAKE_CASE` for constants (e.g., `TERRAIN_TYPES`, `MAP_WIDTH`).
- **Structure:** The code is heavily object-oriented, with clear class hierarchies for units and buildings. When adding new features, extend existing classes where appropriate.

## Key Technologies

- **JavaScript (ES6 Modules)**
- **PixiJS** (for 2D rendering)
- **HTML5 Canvas**

## Important Files for Context

When making changes, always refer to these core files to understand the game's architecture:

-   **`index.html`**: The main entry point. It includes the import map which defines the module paths.
-   **`js/game.js`**: Contains the main game loop (`gameLoop`), map generation logic, and global game state management.
-   **`js/state.js`**: Defines the global `gameState` object that holds all dynamic information about the current game session.
-   **`js/unit.js`**: Defines the class hierarchy for all units (e.g., `Unit`, `WorkerUnit`, `CombatUnit`, `Mage`). This is the place to start for any unit-related changes.
-   **`js/building.js`**: Defines the class hierarchy for all buildings (e.g., `Building`, `Tent`, `Lumberjack`). This is the place to start for any building-related changes.
-   **`js/players.js`**: Defines the `Player` class, which manages units, buildings, and resources for both the human and AI.
-   **`js/renderer.js`**: Handles all drawing operations to the canvas via PixiJS.
-   **`js/pathfinding.js`**: Implements the A* pathfinding algorithm for unit movement.
-   **`js/ui.js`**: Manages all UI elements, including menus, modals, and the in-game HUD.

## File Structure Overview

-   `/`: Root directory containing `index.html` and project metadata files.
-   `assets/`: Contains all static assets like images, sprites, and fonts.
-   `css/`: Contains stylesheets.
-   `js/`: Contains all JavaScript source code, organized into modules.
-   `lib/`: Contains third-party libraries (PixiJS).
-   `maps/`: Contains predefined map data or seeds.

## Directory Exclusions

-   **`assets/unused/`**: This directory contains a large number of unused or inspirational assets. Do not read or analyze the contents of this folder unless specifically asked to.
