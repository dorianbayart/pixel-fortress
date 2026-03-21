# Pixel Fortress Roadmap

## Core Gameplay

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
- [x] **AI Opponent:** Implement AI opponent with automated unit management.  
Details: The AI builds structures and manages units similarly to the player.
- [x] **Market:** Market sells ressources against Money.
- [x] **Tower Placement:** Allow players to strategically place towers.
- [x] **Tower Attacks:** Towers automatically attack enemies within their range.
- [x] **Explorer:** Add an explorer that will be able to move around the map.
- [ ] **Archery:** Add Archery building to produce archer units.
- [ ] **Mage:** Add Mage building to produce mage units.


## User Interface

- [x] **Tower/Building Selection UI:** Display available towers/buildings and allow players to select them.
- [x] **Game Menu:** Implement a main menu, pause menu, and options menu.  
Details: The menu presents what the User can do: Play on random map, Play a predefined map, Play a campaign, Manage options (details, SpecialFX, sound, etc.), etc.
- [x] **Health Display:** Visual representation of the unit's health.
- [x] **Resource Display:** Show the player's current resources.
- [x] **Mini-Map:** Overview of the game world.


## Gameplay

- [x] **Fog of War:** Implement a fog of war mechanism.
- [x] **Building prices:** Prices of buildings are increasing with the amount of buildings already built.  
Details: The price of a building is based on the amount of buildings already built. Maybe 25% more expensive for each building.
- [ ] **Special Maps:** Add predefined maps. *(In progress)*
- [ ] **Campaign Mode:** Add campaigns maps with scenarii. *(Not Planned)*
- [ ] **Unit Resistance:** Implement unit resistance to certain types of damage. *(Not Planned)*


## Game Modes

- [x] **Classic Mode:** Standard gameplay with balanced combat and gathering.
Details: Default game mode with normal unit and building health, standard resource gathering rates.
- [x] **One Shot Mode:** Every unit and building has exactly one life point. Any damage is fatal.
Details: Extreme difficulty mode where any damage is fatal. Requires careful positioning and strategic planning.
- [x] **Turbo Gathering Mode:** All resource gatherers work at significantly increased speed.
Details: Accelerated resource gathering (5x faster) allows for rapid base expansion and army building. Focus on economic strategy.
- [ ] **Tower Defense:** Implement a tower defense mechanic. *(Not Planned)*


## Upgrades and Power-ups

- [x] **Tower Upgrades:** Allow players to upgrade towers to increase their effectiveness.
- [x] **Building Upgrades:** Allow players to upgrade buildings to increase their capacity.  
Details: Can affect more workers, can produce quicklyer units, etc.
- [x] **Building Specialization:** Upgrades open branching paths — buildings evolve into specialized variants (e.g. Tower → Bullet, Rapid or Sniper Tower).
- [ ] **Global Upgrades:** Implement upgrades that affect the entire game (e.g., increased resource gain). *(Not Planned)*  
Details: this will come with a new building: the University.



## Sound and Music

- [ ] **Sound Effects:** Implement sound effects for tower attacks, enemy spawns, etc. *(In Progress)*
- [ ] **Background Music:** Add background music to enhance the game's atmosphere. *(In Progress)*


## Multiplayer (Very Low Priority)

- [ ] **Menu entries:** Add menu entries to choose Multiplayer. *(Not Planned)*  
Details: This should include: pseudo, host a map, join a map
- [ ] **Implementation:** 2 players can play on the same map


## Others

- [x] **Animated water:** Manage the different water sprites to animate.


## Future Features and Ideas

- [x] **New Tower Types:** Towers specialize into Bullet, Rapid, or Sniper variants via the branching upgrade system.
- [ ] **Special Enemies:** Add enemies with special abilities or resistances. *(Not Planned)*
- [x] **Level Editor:** Map editor allowing players to create their own custom maps.
- [ ] **Endless Mode:** Implement an endless mode with increasing difficulty. *(Not Planned)*
- [x] **High Speed:** High speed mode: the time is 1x, 1.33x or 2x accelerated.
- [ ] **PNJs:** Add PNJs enemies on the map. *(Not Planned)*
