# Release Notes

## Version {{version}}

### New Features
- **Towers are here!** Build defensive towers that automatically detect and shoot down approaching enemies — fortify your base and hold the line
- **Building Specialization**: Upgrades now open branching paths — choose how each building evolves and tailor your fortress to your playstyle - a simple tower can specialized to Bullet, Rapid or Sniper Tower !

### Localization
- **Multi-language support**: The game is now available in 4 languages — English, French, German, and Spanish
- **Language selector**: Choose your preferred language directly from the Options menu — preference is saved across sessions

### Visuals
- **Fresh look**: Buildings got stunning new artwork — your fortress has never looked this good
- **Pixel-art UI**: All menus reworked with consistent pixel-art styling — sharp edges, gold borders, and pixelated controls throughout

---

## Version 0.0.3

### Major Improvements
- **Renderer Rework**: Complete renderer overhaul achieving full 60 FPS even on huge maps
- **PixiJS v8.15**: Upgraded to latest PixiJS version with improved text rendering
- **FPS Limit Option**: Added configurable FPS limit in game options

### Performance Optimizations
- Reworked viewport tile visibility calculations for significant performance gains
- Optimized water sprite updates in game loop
- Improved sprite cleanup in background drawing logic
- Reduced viewport buffer size for better memory usage
- Enhanced zoom factors for smoother camera control

### Bug Fixes
- Fixed UI glitches when restarting the game
- Fixed text rendering issues after PixiJS upgrade
- Removed unnecessary viewport updates

### UI/UX
- Add a Fullscreen toggle button
- Rewrote and improved landing page texts with CSS refinements
- Simplified viewport movement controls

---

## Version 0.0.2

### New Features
- **Game Modes**: Three new gameplay modes - Classic, One Shot (1 HP units), and Turbo Gatherer (5x resource speed)
- **Animated Water**: Fully animated water sprites with expanded tileset
- **Huge Maps**: New "Huge" map size + billion possible seeds (1,000,000,000 unique maps!)
- **Skirmish menu**: Rework the menu to implement a "Skirmish" mode
- **Predefined Maps**: Preview and play curated maps
- **High Quality Parameter**: Add a High Quality parameter for very fine resolution

### Optimizations
- **Exploration**: Unexplored tiles are now carefully choosen, let's reveal the map !
- **Wood harvest**: Trees selection is more efficient

### Performance
- Optimized pathfinding logic to prevent spikes and unit freezes
- Improved fog of war and progress indicator rendering

### Bug Fixes
- Fixed health bar display
- Fixed so many bugs...

---

## Version 0.0.1

This is the first release of Pixel Fortress ! ✨
Already fully playable and ready for testing.

### Features
- **Landing Page**: Dedicated landing page at index.html, game at play.html
- **CI/CD**: Automated builds for Windows and Linux (MacOS build is broken at this time)
- **Minimap**: Overview of the entire game world
- **Health Bars**: Optional health bar display on damaged units
- **Fog of War**: Visibility system with explorer units
- **Smart Map Generation**: Intelligent tent placement ensuring all seeds are valid

Thank you for playing!
