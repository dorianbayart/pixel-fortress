# Pixel Fortress Roadmap

## Core Gameplay (High Priority)

- [x] **Game Initialization:** Game window creation, initial resource loading.
- [x] **Map Generation:** A basic map is randomly generated.
- [x] **Load Sprites:** Load more sprites to display different kind of units and buildings.
- [x] **Define Classes:** Define classes for units, buildings, towers, with their type, characteristics, etc.
- [x] **Resource Gathering:** Implement resource gathering AI.  
Details: Worker units automatically locate and gather resources.
- [x] **Resource Management:** Implement a system for collecting and spending resources.
- [x] **Build Placement:** Allow players to strategically place buildings.  
Details: Buildings can produce different kind of units.
- [x] **Unit Production:** Implement automated unit production from buildings.  
Details: Buildings generate worker units (gather resources) and combat units (attack).
- [x] **Enemy Spawning:** Generate enemies that move towards the player's base.
- [x] **Combat:** Implement combat AI for units.  
Details: Combat units automatically engage and attack enemy units and buildings.
- [x] **Game Over Condition:** Handling game over scenarios (base health reaches zero).
- [x] **Win Condition:** Handling win scenarios (enemy base health reaches zero).
- [x] **AI Opponent:** Implement AI opponent with automated unit management. *(In Progress)*  
Details: The AI builds structures and manages units similarly to the player.
- [x] **Market:** Market sells ressources against Money.
- [ ] **Tower Placement:** Allow players to strategically place towers. *(Not Planned)*
- [ ] **Tower Attacks:** Towers automatically attack enemies within their range. *(Not Planned)*


## User Interface (Medium Priority)

- [x] **Tower/Building Selection UI:** Display available towers/buildings and allow players to select them.
- [ ] **Game Menu:** Implement a main menu, pause menu, and options menu. *(In Progress)*  
Details: The menu presents what the User can do: Play on random map, Play a predefined map, Play a campaign, Manage options (details, SpecialFX, sound, etc.), etc.
- [ ] **Base Health Display:** Visual representation of the base's health. *(Not Planned)*
- [x] **Resource Display:** Show the player's current resources.
- [ ] **Mini-Map:** Overview of the game world.


## Gameplay (Medium Priority)

- [x] **Fog of War:** Implement a fog of war mechanism.
- [x] **Building prices:** Prices of buildings are increasing with the amount of buildings already built. *(In Progress)*  
Details: The price of a building is based on the amount of buildings already built. Maybe 25% more expensive for each building.
- [ ] **Special Maps:** Add predefined maps. *(Not Planned)*
- [ ] **Campaign Mode:** Add campaigns maps with scenarii. *(Not Planned)*


## Upgrades and Power-ups (Medium Priority)

- [ ] **Tower Upgrades:** Allow players to upgrade towers to increase their effectiveness. *(Not Planned)*
- [x] **Building Upgrades:** Allow players to upgrade buildings to increase their capacity.
Details: Can affect more workers, can produce quicklyer units, etc.
- [ ] **Global Upgrades:** Implement upgrades that affect the entire game (e.g., increased resource gain). *(Not Planned)*


## Sound and Music (Low Priority)

- [ ] **Sound Effects:** Implement sound effects for tower attacks, enemy spawns, etc. *(In Progress)*
- [ ] **Background Music:** Add background music to enhance the game's atmosphere. *(In Progress)*


## Multiplayer (Very Low Priority)

- [ ] **Menu entries:** Add menu entries to choose Multiplayer. *(Not Planned)*  
Details: This should include: pseudo, host a map, join a map
- [ ] **Implementation:** 2 players can play on the same map


## Others

- [ ] **Explorer:** Add an explorer that will be able to move around the map. *(Not Planned)*
- [ ] **Animated water:** Manage the different water sprites to animate it. *(Not Planned)*


## Future Features and Ideas

- [ ] **New Tower Types:** Introduce new towers with unique abilities. *(Not Planned)*
- [ ] **Special Enemies:** Add enemies with special abilities or resistances. *(Not Planned)*
- [ ] **Level Editor:** Allow players to create their own custom levels. *(Not Planned)* 
- [ ] **Endless Mode:** Implement an endless mode with increasing difficulty. *(Not Planned)*
- [x] **High Speed:** High speed mode: the time is 1x, 1.33x or 2x accelerated.