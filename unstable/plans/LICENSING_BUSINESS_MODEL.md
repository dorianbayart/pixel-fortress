# Licensing & Business Model for Pixel Fortress

## Chosen Strategy: Open Source Freemium with Feature Flags

### Business Model Summary

**Free Version (Web + Desktop)**
- Full source code available (open source)
- Core RTS gameplay
- First 5 campaign levels
- Limited predefined maps
- Random map generation with custom seeds
- Desktop builds available (without Steam features)
- Local saves for progression

**Premium Version (Steam - $4.99)**
- Same open source codebase
- Additional content unlocked via `STEAM_BUILD` flag
- Full campaign (unlimited levels, continuously updated)
- All predefined maps (premium + free)
- Additional game modes
- Map editor
- Steam achievements
- Steam cloud saves for progression
- Desktop builds with Steam integration
- Support the developer

**Key Principle**: The entire codebase is open source. Premium features are gated by build configuration, not closed source. Players pay for extra content, Steam features, and to support continued development.

---

## Licensing Structure

### Chosen License: GNU General Public License v3 (GPL v3)

**Why GPL v3?**
- ✅ Strong copyleft ensures derivative works remain open source
- ✅ Allows commercial use (including Steam distribution)
- ✅ Compatible with Steam distribution
- ✅ Prevents proprietary forks that don't share improvements
- ✅ Proven track record with successful indie games (Mindustry, Unciv)
- ✅ Protects the open source nature of the project
- ✅ Ensures community contributions benefit everyone
- ✅ Requires attribution and source code sharing

**License Text** (in `LICENSE` file):
The full GNU General Public License v3 text is provided in the `LICENSE` file at the root of the repository.

Key points:
- Copyright (c) 2026 Dorian Bayart
- Licensed under GNU GPL v3
- Anyone can use, modify, and distribute this software
- Derivative works must also be licensed under GPL v3
- Source code must be made available
- Commercial use is permitted (including Steam sales)

### Asset Licenses (Third-Party)

**Status**: ✅ Verified commercial use is permitted

**Assets Used**:
- **Puny World** by Merchant-Shade - Commercial use allowed
- **Mini World** by Merchant-Shade - Commercial use allowed
- **Pixel Icon Library** by HackerNoon - Open source

**Attribution** (optional but included for good practice):
Will be maintained in credits and `CREDITS.md` file.

---

## Technical Implementation: Feature Flags

### Build Configuration System

The game will use environment-based feature flags to differentiate between free and premium builds.

#### 1. Create Build Configuration File

**`js/buildConfig.mjs`** (new file):
```javascript
// Build configuration
// This file determines which features are available based on the build type

// Detect if running in Steam build
// In production, this will be set during build process
// In development, can be overridden with ?steam=true query parameter
const urlParams = new URLSearchParams(window.location.search)
const forceSteam = urlParams.get('steam') === 'true'

// Check if Electron environment (desktop build)
const isElectron = typeof window !== 'undefined' &&
                   typeof window.process !== 'undefined' &&
                   window.process.type === 'renderer'

// Check if Steam build (set during electron-builder process)
export const IS_STEAM_BUILD = forceSteam ||
                              (isElectron && process.env.STEAM_BUILD === 'true') ||
                              false

// Feature flags
export const FEATURES = {
  // Content flags
  FULL_CAMPAIGN: IS_STEAM_BUILD,
  PREMIUM_MAPS: IS_STEAM_BUILD,
  BONUS_GAME_MODES: IS_STEAM_BUILD,
  MAP_EDITOR: IS_STEAM_BUILD,

  // Platform flags
  STEAM_ACHIEVEMENTS: IS_STEAM_BUILD,
  STEAM_CLOUD_SAVES: IS_STEAM_BUILD,
  STEAM_RICH_PRESENCE: IS_STEAM_BUILD,
}

// Content limits for free version
export const LIMITS = {
  MAX_CAMPAIGN_LEVELS: IS_STEAM_BUILD ? 999 : 5,
}

// Version info
export const BUILD_INFO = {
  version: '0.0.4',
  buildType: IS_STEAM_BUILD ? 'Steam' : 'Free',
  platform: isElectron ? 'Desktop' : 'Web',
}

// Display build info in console
console.log('🎮 Pixel Fortress', BUILD_INFO.version)
console.log('📦 Build:', BUILD_INFO.buildType)
console.log('💻 Platform:', BUILD_INFO.platform)
```

#### 2. Update Import Map

**In `index.html`**, add to import map:
```html
<script type="importmap">
{
  "imports": {
    "buildConfig": "./js/buildConfig.mjs",
    // ... existing imports
  }
}
</script>
```

#### 3. Use Feature Flags Throughout Code

**Example: Campaign Selection** (`js/campaign.mjs`):
```javascript
import { FEATURES, LIMITS } from 'buildConfig'

export function getAvailableCampaignLevels() {
  const allLevels = [
    // Levels 1-5: Free for everyone
    { id: 1, name: 'Tutorial', difficulty: 'easy', free: true },
    { id: 2, name: 'First Defense', difficulty: 'easy', free: true },
    { id: 3, name: 'Resource Rush', difficulty: 'medium', free: true },
    // ...

    // Levels 6+: Premium only (will grow with updates)
    { id: 6, name: 'Mountain Siege', difficulty: 'medium', premium: true },
    { id: 7, name: 'Desert Storm', difficulty: 'hard', premium: true },
    { id: 8, name: 'River Crossing', difficulty: 'medium', premium: true },
    // ... more levels will be added continuously
  ]

  // Filter based on build type
  if (FEATURES.FULL_CAMPAIGN) {
    return allLevels // All levels available
  } else {
    return allLevels.filter(level => level.free) // Only free levels
  }
}

export function isCampaignLevelLocked(levelId) {
  return levelId > LIMITS.MAX_CAMPAIGN_LEVELS
}
```

**Example: Predefined Maps** (`maps/predefined_maps.json`):
```json
{
  "maps": [
    {
      "id": "valley_battle",
      "name": "Valley Battle",
      "seed": 12345,
      "difficulty": "easy",
      "free": true,
      "description": "A peaceful valley with balanced resources"
    },
    {
      "id": "island_fortress",
      "name": "Island Fortress",
      "seed": 67890,
      "difficulty": "medium",
      "free": true,
      "description": "Build your fortress on a strategic island"
    },
    {
      "id": "mountain_pass",
      "name": "Mountain Pass",
      "seed": 11111,
      "difficulty": "hard",
      "premium": true,
      "description": "Navigate treacherous mountain terrain"
    },
    {
      "id": "desert_oasis",
      "name": "Desert Oasis",
      "seed": 22222,
      "difficulty": "medium",
      "premium": true,
      "description": "Fight for control of precious water sources"
    }
  ]
}
```

**Map Selection Logic** (`js/mapSelection.mjs`):
```javascript
import { FEATURES } from 'buildConfig'

export async function getAvailableMaps() {
  // Load predefined maps from JSON
  const response = await fetch('maps/predefined_maps.json')
  const data = await response.json()

  // Filter based on build type
  const availableMaps = data.maps.filter(map => {
    if (map.free) return true // Free maps always available
    if (map.premium && FEATURES.PREMIUM_MAPS) return true
    return false
  })

  // Add random map generation option (always available)
  availableMaps.push({
    id: 'random',
    name: 'Random Map',
    description: 'Generate a unique map with custom seed',
    isRandom: true,
    free: true
  })

  return availableMaps
}

export function canAccessMap(map) {
  if (map.free) return true
  if (map.premium && FEATURES.PREMIUM_MAPS) return true
  return false
}
```

**Example: Game Modes** (`js/gameMode.mjs`):
```javascript
import { FEATURES } from 'buildConfig'

export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Standard RTS gameplay',
    free: true
  },
  // Premium modes will be defined here as they are developed
  // Examples: survival, rush mode, puzzle challenges, etc.
}

export function getAvailableGameModes() {
  return Object.values(GAME_MODES).filter(mode => {
    if (mode.free) return true
    if (mode.premium && FEATURES.BONUS_GAME_MODES) return true
    return false
  })
}

export function isGameModeLocked(modeId) {
  const mode = GAME_MODES[modeId]
  if (!mode) return true
  if (mode.free) return false
  return !FEATURES.BONUS_GAME_MODES
}
```

**Example: UI with Premium Badges** (`js/menu.mjs`):
```javascript
import { IS_STEAM_BUILD } from 'buildConfig'

export function createMapSelectionUI() {
  const maps = await getAvailableMaps()

  maps.forEach(map => {
    const mapButton = createButton(map.name)

    // Show premium badge for locked content
    if (map.premium && !IS_STEAM_BUILD) {
      const badge = document.createElement('span')
      badge.className = 'premium-badge'
      badge.textContent = '⭐ Steam'
      badge.title = 'Available in Steam version'
      mapButton.appendChild(badge)

      // Add click handler to show upgrade prompt
      mapButton.addEventListener('click', (e) => {
        e.preventDefault()
        showUpgradeModal('Unlock all predefined maps on Steam!')
      })
    }

    container.appendChild(mapButton)
  })
}

function showUpgradeModal(message) {
  // Show modal encouraging Steam purchase
  const modal = document.createElement('div')
  modal.className = 'upgrade-modal'
  modal.innerHTML = `
    <h2>⭐ Premium Feature</h2>
    <p>${message}</p>
    <p>Get the full game on Steam for:</p>
    <ul>
      <li>Full campaign (continuously updated)</li>
      <li>All predefined maps</li>
      <li>Unique game modes</li>
      <li>Map editor</li>
      <li>Steam achievements</li>
      <li>Cloud save progression</li>
      <li>Desktop builds with Steam integration</li>
      <li>Support continued development!</li>
    </ul>
    <div class="modal-buttons">
      <a href="https://store.steampowered.com/app/YOUR_APP_ID"
         target="_blank"
         class="btn-primary">
        Get on Steam - $4.99
      </a>
      <button class="btn-secondary" onclick="this.closest('.upgrade-modal').remove()">
        Continue with Free Version
      </button>
    </div>
  `
  document.body.appendChild(modal)
}
```

**Example: Save Progression** (`js/saveGame.mjs`):
```javascript
import { FEATURES } from 'buildConfig'

export async function saveGameProgress(progressData) {
  if (FEATURES.STEAM_CLOUD_SAVES) {
    // Save to Steam Cloud using Steam API
    try {
      await steamAPI.saveToCloud('game_progress.json', progressData)
      console.log('Progress saved to Steam Cloud')
      return true
    } catch (error) {
      console.error('Failed to save to Steam Cloud:', error)
      return false
    }
  } else {
    // Free version: no persistent save
    console.warn('Save progression is only available in Steam version')
    console.log('Progress will be lost when the game is closed')
    return false
  }
}

export async function loadGameProgress() {
  if (FEATURES.STEAM_CLOUD_SAVES) {
    // Load from Steam Cloud
    try {
      const progressData = await steamAPI.loadFromCloud('game_progress.json')
      console.log('Progress loaded from Steam Cloud')
      return progressData
    } catch (error) {
      console.error('Failed to load from Steam Cloud:', error)
      return null
    }
  } else {
    // Free version: no persistent save
    console.log('No saved progress available (Steam version only)')
    return null
  }
}
```

#### 4. Electron Build Scripts for Steam

**Update `package.json`**:
```json
{
  "scripts": {
    "start": "electron .",
    "start:steam": "STEAM_BUILD=true electron .",
    "build": "electron-builder",
    "build:steam": "cross-env STEAM_BUILD=true electron-builder --dir",
    "update-manifest-version": "node scripts/update-manifest-version.js",
    "test": "node tests/*.test.mjs && node tests/testRunner.mjs"
  },
  "devDependencies": {
    "@electron/notarize": "^3.1.0",
    "cross-env": "^7.0.3",
    "electron": "^38.4.0",
    "electron-builder": "^26.0.12"
  }
}
```

**Update `main.js`**:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set environment variable for Steam build detection
if (process.env.STEAM_BUILD === 'true') {
  process.env.STEAM_BUILD = 'true'
  console.log('🎮 Running Steam Build')
} else {
  console.log('🆓 Running Free Build (Desktop)')
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile('index.html');

  // Expose build info to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('build-info', {
      isSteam: process.env.STEAM_BUILD === 'true'
    });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

---

## Free vs Premium Feature Breakdown

### Free Version (Web + Desktop)

**Included**:
- ✅ Core RTS gameplay
- ✅ First 5 campaign levels
- ✅ Selected predefined maps (marked as 'free')
- ✅ Random map generation with custom seeds
- ✅ Classic game mode
- ✅ All units and buildings
- ✅ Single-player vs AI
- ✅ Desktop builds available (Windows, macOS, Linux)
- ✅ Full source code access

**Limited**:
- ⚠️ Campaign limited to 5 levels
- ⚠️ No access to premium predefined maps
- ⚠️ No additional game modes
- ⚠️ No map editor
- ⚠️ No save progression (session only)
- ⚠️ No Steam achievements
- ⚠️ No Steam integration

### Premium Version (Steam - $4.99)

**Everything from Free, PLUS**:
- 🌟 Full campaign (unlimited levels, continuously updated)
- 🌟 All predefined maps (free + premium)
- 🌟 Unique game modes
- 🌟 Map editor
- 🌟 Steam achievements
- 🌟 Steam cloud saves (persistent progression)
- 🌟 Steam rich presence
- 🌟 Desktop builds with Steam integration
- 🌟 Priority support
- 🌟 Support continued development!

---

## GitHub Repository Structure

The entire codebase remains in one repository, fully open source:

```
pixel-fortress/
├── js/
│   ├── buildConfig.mjs         # ⭐ Feature flag configuration
│   ├── campaign.mjs            # Campaign logic with premium levels
│   ├── gameMode.mjs            # All game modes (some gated)
│   ├── mapSelection.mjs        # Map selection with premium filtering
│   ├── saveGame.mjs            # Save system (Steam Cloud only)
│   └── ...                     # All other game files
├── maps/
│   └── predefined_maps.json    # All maps with free/premium flags
├── assets/
│   ├── units/
│   ├── buildings/
│   └── ...
├── plans/
│   ├── ROADMAP.md              # Development roadmap
│   ├── LICENSING_BUSINESS_MODEL.md  # This file
│   └── STEAM_DEPLOYMENT.md     # Steam deployment guide
├── tests/
├── .github/
│   └── workflows/
│       ├── build.yml           # Free builds
│       └── steam-build.yml     # Steam builds
├── LICENSE                     # MIT License
└── README.md
```

**Key Points**:
- ✅ All code is public and visible
- ✅ Premium content is in the same repo (not hidden)
- ✅ Anyone can view, learn from, and contribute to ALL code
- ✅ Premium features simply check `FEATURES.FULL_CAMPAIGN`, etc.
- ✅ Community can compile their own "premium" version if desired
- ✅ Steam provides convenience, cloud saves, and support

---

## Repository Documentation Updates

### README.md Updates

**Add clear explanation at the top**:
```markdown
# Pixel Fortress

A 2D pixel-based strategy game - **100% open source!**

## 🎮 Play Now

### Free Version (Web + Desktop)
➡️ **[Play in Browser](https://dorianbayart.github.io/pixel-fortress/)** - Always free!

Includes:
- Core RTS gameplay
- First 5 campaign levels
- Random map generation
- Selected predefined maps
- Desktop builds available

### Premium Version (Steam - $4.99)
⭐ **[Get on Steam](https://store.steampowered.com/app/YOUR_APP_ID)**

Everything in free version, plus:
- Full campaign (continuously updated with new levels)
- All premium predefined maps
- Additional unique game modes
- Map editor
- Steam achievements
- Cloud save progression
- Desktop builds with Steam integration

**Note**: The entire game is open source (GPL v3 License). You can build the
"Steam version" yourself from source, but purchasing on Steam supports
development and provides Steam features (achievements, cloud saves).

## 📖 Open Source

This game is 100% open source under the GPL v3 License. All features, including
"premium" content, are visible in this repository. Premium features are
gated by build configuration (`STEAM_BUILD` flag), not closed source.

**Why pay if it's open source?**
- Support continued development and new content
- Steam cloud saves for persistent progression
- Steam achievements
- Convenience (auto-updates, easy install)
- Show appreciation for open source work

View the code, learn from it, contribute to it, or compile your own builds!

## 📜 License

GNU General Public License v3 (GPL v3) - See [LICENSE](LICENSE) for details.

**Assets**: Commercial use permitted (Puny World, Mini World by Merchant-Shade)
```

### Create CREDITS.md

```markdown
# Credits & Attributions

## Game Development
- **Lead Developer**: Dorian Bayart
- **Repository**: https://github.com/dorianbayart/pixel-fortress

## Art & Assets

### Sprite Assets
- **Puny World** by [Merchant-Shade](https://merchant-shade.itch.io/)
  - License: Commercial use permitted
  - Source: https://merchant-shade.itch.io/16x16-puny-world

- **Mini World** by [Merchant-Shade](https://merchant-shade.itch.io/)
  - License: Commercial use permitted
  - Source: https://merchant-shade.itch.io/16x16-mini-world-sprites

### Icons
- **Pixel Icon Library** by HackerNoon
  - License: Open Source
  - Source: https://github.com/hackernoon/pixel-icon-library

## Technology Stack
- **PixiJS**: 2D WebGL rendering library
- **Electron**: Desktop application framework
- **Node.js**: Build and development tools

## Special Thanks
- The open source community
- All contributors to the project
- Players who support development by purchasing on Steam

## Support
If you enjoy this game and want to support development:
- ⭐ Star the repository on GitHub
- 💬 Share feedback and bug reports
- 🛒 Purchase on Steam
- 🤝 Contribute code or ideas
```

---

## Steam Store Page Content

### Short Description (300 chars)
```
Build your fortress, gather resources, and command armies in this open source
pixel RTS! Features full campaign, all predefined maps, and Steam achievements.
100% open source - support development while enjoying premium content!
```

### About This Game
```
Pixel Fortress is a 2D real-time strategy game that merges Tower Defense depth
with addictive Clicker simplicity. Best of all, it's 100% open source!

🌟 STEAM PREMIUM FEATURES

This Steam version includes exclusive premium content:

• Full Campaign - Continuously updated with new missions and challenges
• All Maps - Access all predefined maps with unique scenarios
• Additional Unique Game Modes - New ways to play and challenge yourself
• Map Editor - Create and play your own custom maps
• Steam Achievements - Unlock achievements as you progress
• Cloud Saves - Your progression is saved and synced across devices
• Desktop Builds - Native Windows, macOS, and Linux support

💡 OPEN SOURCE TRANSPARENCY

The full source code is available on GitHub (GPL v3 License):
https://github.com/dorianbayart/pixel-fortress

You can view all code, learn from it, contribute, or even compile your own
builds. By purchasing on Steam, you're supporting continued development while
getting Steam features like cloud saves and achievements.

🎮 GAMEPLAY

Strategic base building meets automated unit combat:
• Build resource-gathering structures (lumber mills, mines, wells)
• Train armies that fight automatically
• Manage multiple unit types with unique abilities
• Battle against intelligent AI opponents
• Explore randomly generated maps with varied terrain

Whether you're playing the free web version or this premium Steam release,
you're getting a polished, community-driven RTS experience!

🤝 SUPPORT INDIE DEVELOPMENT

Purchasing on Steam directly supports:
• Continued development and new campaign levels
• Bug fixes and performance improvements
• Community-requested features
• Open source contributions
```

### System Requirements
```
MINIMUM:
- OS: Windows 10 / macOS 10.13 / Ubuntu 18.04
- Processor: Intel Core i3 or equivalent
- Memory: 2 GB RAM
- Graphics: Integrated graphics with WebGL support
- Storage: 500 MB available space

RECOMMENDED:
- OS: Windows 11 / macOS 13 / Ubuntu 22.04
- Processor: Intel Core i5 or equivalent
- Memory: 4 GB RAM
- Graphics: Dedicated GPU
- Storage: 1 GB available space
```

---

## Community Communication Strategy

### Handling "Why Pay?" Questions

**Anticipated Question**: "Why should I pay if I can compile it myself?"

**Response Template**:
```
Great question! Here's the deal:

The game is 100% open source (GPL v3 License) because we believe in:
- Transparency
- Educational value
- Community contributions
- Freedom to modify and learn

You absolutely CAN compile the Steam version yourself from source.
The premium features are just gated by a build flag, not hidden.

However, most players purchase on Steam for:
1. Cloud Saves - Steam API integration for persistent progression
2. Achievements - Track your accomplishments
3. Support - Directly fund continued development and new content
4. Convenience - One click install, auto-updates
5. Desktop Integration - Native Steam builds

Think of it like supporting a musician by buying their album even though
they offer free streaming. You're paying for features and to support
the creator.

If you're a developer wanting to learn or contribute, compile away!
If you're a player wanting cloud saves and to support development, Steam is the way to go.
```

### Discord/Community FAQ

Create a pinned FAQ message:
```
❓ FREQUENTLY ASKED QUESTIONS

Q: Is this game really open source?
A: Yes! 100% GPL v3 License. View all code on GitHub.

Q: What's the difference between free and Steam versions?
A: Free = 5 campaign levels, limited maps, no save progression
   Steam = full campaign, all maps, cloud saves, achievements
   See full comparison: [link]

Q: Can I compile the "premium" version myself?
A: Technically yes! The code is public. But you won't get Steam features
   like cloud saves and achievements without the Steam API.

Q: Will desktop builds work without Steam?
A: Yes! Free desktop builds are available. They just won't have Steam
   integration or premium content access.

Q: Can I contribute to the code?
A: Absolutely! PRs welcome. See CONTRIBUTING.md for guidelines.

Q: Will new campaign levels be added?
A: Yes! The Steam version will receive continuous updates with new levels.
```

---

## Contributor Guidelines

### Create CONTRIBUTING.md

```markdown
# Contributing to Pixel Fortress

Thank you for considering contributing to Pixel Fortress! This is an open
source project, and we welcome contributions of all kinds.

## How to Contribute

### Code Contributions
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (run `npm run test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### What to Contribute
- Bug fixes
- Performance improvements
- New campaign levels
- New game modes
- New predefined maps
- UI/UX improvements
- Documentation
- Test coverage
- Accessibility features

### Code Style
- Follow existing code style (see CLAUDE.md)
- Use ES6+ JavaScript
- No semicolons
- Single quotes for strings
- Meaningful variable names

### Premium Features
You're welcome to contribute to "premium" features (campaign levels,
predefined maps, game modes, etc.). These features are visible in the code
and gated by `FEATURES` flags in `buildConfig.mjs`.

Your contributions to premium features still help the community:
- Code is educational and transparent
- Players can learn from it
- Improves the overall game quality
- You'll be credited in CREDITS.md

## Adding Predefined Maps

To add a new predefined map, edit `maps/predefined_maps.json`:

```json
{
  "id": "unique_map_id",
  "name": "Display Name",
  "seed": 12345,
  "difficulty": "easy|medium|hard",
  "free": true,  // or "premium": true
  "description": "A brief description of the map"
}
```

## License
By contributing, you agree that your contributions will be licensed under
the GNU General Public License v3 (GPL v3).

## Questions?
Open an issue or reach out on Discord: [link]
```

---

## Real-World Examples Using This Model

### 1. **Mindustry** ⭐ Closest Match
- **Model**: Fully open source (GPL), free on itch.io/GitHub, paid on Steam
- **Price**: $9.99 on Steam
- **Success**: Very profitable, 100k+ positive reviews
- **Code**: https://github.com/Anuken/Mindustry
- **Approach**: Same game free and paid, Steam is pure convenience

### 2. **Unciv**
- **Model**: Fully open source (GPL), free on F-Droid/GitHub, paid on Google Play
- **Price**: $4.99 on Google Play
- **Success**: Sustainable income from convenience purchases
- **Code**: https://github.com/yairm210/Unciv

### 3. **Pixel Dungeon / Shattered Pixel Dungeon**
- **Model**: Open source (GPL), free everywhere, donations
- **Success**: Multiple successful forks, strong community
- **Code**: https://github.com/00-Evan/shattered-pixel-dungeon
- **Note**: Could have monetized but chose pure open source

### 4. **Dwarf Fortress** (Hybrid)
- **Model**: Free ASCII version, paid Steam version with graphics
- **Price**: $29.99 on Steam
- **Success**: Recouped development costs in 2 days
- **Note**: Not fully open source, but similar "free + premium" approach

---

## Implementation Timeline

### Phase 1: Code Restructuring (1-2 weeks)
- [ ] Create `js/buildConfig.mjs` with feature flags
- [ ] Implement `IS_STEAM_BUILD` detection
- [ ] Create `maps/predefined_maps.json` structure
- [ ] Add map filtering logic for free/premium
- [ ] Implement campaign level limiting (5 free, unlimited premium)
- [ ] Add premium UI badges and upgrade prompts
- [ ] Implement Steam Cloud save system

### Phase 2: Content Creation (2-3 weeks)
- [ ] Design predefined maps (mix of free and premium)
- [ ] Create additional campaign levels (level 4+)
- [ ] Design additional game modes
- [ ] Plan map editor features

### Phase 3: Testing (1 week)
- [ ] Test free build (web)
- [ ] Test free desktop builds (without Steam)
- [ ] Test Steam build (desktop with Steam API)
- [ ] Verify feature gates work correctly
- [ ] Test save progression with Steam Cloud
- [ ] Cross-platform testing

### Phase 4: Documentation (1 week)
- [ ] Update README.md with clear free vs premium
- [ ] Update LICENSE to MIT
- [ ] Create CREDITS.md
- [ ] Create CONTRIBUTING.md
- [ ] Update package.json license field

### Phase 5: Steam Preparation (2-3 weeks)
- [ ] Follow STEAM_DEPLOYMENT.md
- [ ] Create marketing assets
- [ ] Write store page content
- [ ] Set up Steamworks account
- [ ] Configure Steam builds and achievements

### Phase 6: Launch (Ongoing)
- [ ] Beta test with community
- [ ] Launch on Steam
- [ ] Monitor reviews
- [ ] Engage with community
- [ ] Release new campaign levels regularly

**Total Timeline**: 7-10 weeks to Steam launch

---

## Marketing Strategy

### GitHub/Open Source Community
- Post on r/opensourcegames
- Post on r/gamedev
- Submit to awesome-open-source lists
- Hacker News "Show HN"
- Dev.to article about the model

### Steam Launch
- Launch discount (10-15% off)
- Press kit for gaming journalists
- Reach out to indie game YouTubers
- Emphasize open source angle (unique!)
- Reddit r/IndieGaming, r/StrategyGames

### Content Marketing
- "Why I Open Sourced My Commercial Game" blog post
- Development devlogs showing new features
- Tutorial videos showing game systems
- "How It's Built" technical articles

### Community Building
- Discord server
- GitHub Discussions
- Regular development updates
- Showcase community contributions
- Feature community-created maps

---

## Risk Mitigation

### Risk: Someone Compiles and Redistributes
**Likelihood**: Low (too much effort for most people)
**Impact**: Low (they won't get Steam features like cloud saves)
**Mitigation**:
- Clear branding on official versions
- Steam provides unique value (cloud saves, achievements)
- Community will naturally support original
- Most players value convenience over DIY

### Risk: Low Sales Due to Free Version
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Premium features provide clear value
- Cloud saves are killer feature
- Emphasize supporting development
- Regular content updates for premium
- Similar games (Mindustry, Unciv) have succeeded

### Risk: Competitor Forks
**Likelihood**: Very Low (niche game, open market)
**Impact**: Low (validates your success)
**Mitigation**:
- First-mover advantage
- Community loyalty
- Continuous development
- Superior official support

---

## Next Steps

1. **Immediate**:
   - [ ] Create `js/buildConfig.mjs`
   - [ ] Add feature flag system
   - [ ] Update LICENSE to GPL v3
   - [ ] Update package.json

2. **Short Term** (This Week):
   - [ ] Create `maps/predefined_maps.json` structure
   - [ ] Implement map filtering logic
   - [ ] Add campaign level limiting
   - [ ] Design first set of predefined maps

3. **Medium Term** (Next 2 Weeks):
   - [ ] Create additional campaign levels (4+)
   - [ ] Implement Steam Cloud save system
   - [ ] Add premium UI elements
   - [ ] Update all documentation (README, CREDITS, CONTRIBUTING)

4. **Long Term** (Next Month):
   - [ ] Follow STEAM_DEPLOYMENT.md
   - [ ] Launch on Steam
   - [ ] Engage community
   - [ ] Plan regular content updates

---

## Conclusion

This approach balances open source principles with sustainable revenue:
- ✅ Full transparency (all code public)
- ✅ Educational value (anyone can learn)
- ✅ Community contributions (PRs welcome)
- ✅ Revenue potential (Steam cloud saves + content)
- ✅ Ethical model (no secrets, clear value)

Players who want free gameplay get it (including desktop builds). Players who
want the full campaign, all maps, cloud saves, and achievements can buy on Steam.
Everyone wins.

The key differentiators for Steam:
- **Cloud save progression** (unique to Steam API)
- **Full campaign** with continuous updates
- **All predefined maps**
- **Steam achievements**
- **Support development**

**Value Proposition**:
"Play free forever with core content, or get the full experience with cloud saves
and all content for the price of a coffee. Your choice, and the code is always open!"

---

**Document Version**: 1.1
**Last Updated**: 2026-01-21
**Status**: Implementation Ready
**License Model**: GPL v3 + Open Source Freemium
