# Steam Deployment Plan for Pixel Fortress

## Current Status
- **Version**: 0.0.4
- **Current Platforms**: GitHub (web), GitHub Releases (Windows .exe, macOS .dmg, Linux .AppImage), itch.io (planned)
- **Build System**: Electron + electron-builder with GitHub Actions CI/CD
- **License**: GNU General Public License v3.0 or later (GPL-3.0-or-later) ✓

## Overview
This document outlines the requirements, steps, and considerations for deploying Pixel Fortress on the Steam platform.

---

## Phase 1: Prerequisites & Account Setup

### 1.1 Steam Partner Account
- [ ] Create a Steamworks account at [partner.steamgames.com](https://partner.steamgames.com)
- [ ] Pay the $100 USD Steam Direct fee (one-time per game, recoupable after $1,000 in sales)
- [ ] Complete tax and banking information for revenue payouts
- [ ] Wait for account approval (typically 1-3 business days)

### 1.2 Legal & Licensing Considerations ✓
**Current Status**: The game is licensed under **GPL-3.0-or-later**, which **permits commercial use** on Steam.

The GNU General Public License v3.0 is compatible with commercial distribution while keeping the code open source. Key points:
- ✓ Commercial use is allowed (including paid sales on Steam)
- ✓ Source code must remain available (can link to GitHub repository)
- ✓ Derivative works must also be licensed under GPL v3
- ✓ The license is already updated in `LICENSE`, `package.json`, and `README.md`
- ✓ Used assets licenses are compatible with GPL v3

**Remaining Actions**:
- [ ] Add GPL license notice to Steam store page (recommended for transparency)
- [ ] Ensure Steam distribution includes or links to source code repository

### 1.3 Game Requirements Check
- [x] The game runs on Windows ✓
- [x] The game runs on macOS ✓ (though .dmg signing currently doesn't work)
- [x] The game runs on Linux ✓
- [ ] Minimum system requirements documented
- [ ] Recommended system requirements documented
- [ ] Game content rated (age rating, content warnings)

---

## Phase 2: Technical Integration

### 2.1 Steamworks SDK Integration

#### Install Greenworks (Steamworks for Electron)
Greenworks is a Node.js addon that allows Electron apps to integrate with Steamworks API.

**Installation**:
```bash
npm install --save steamworks.js
# or
npm install --save greenworks
```

**Key Files to Modify**:
- [x] `package.json`: Add steamworks dependency
- [x] `main.js`: Initialize Steamworks SDK
- [ ] Create `js/steam.mjs`: Steam API wrapper module

**Example Integration** (`main.js`):
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let greenworks;
try {
  greenworks = require('steamworks.js');
} catch (e) {
  console.log('Steamworks not available (running outside Steam)');
}

function createWindow () {
  // Initialize Steam if available
  if (greenworks && greenworks.init()) {
    console.log('Steam initialized successfully');
    console.log('Steam User ID:', greenworks.getSteamId().screenName);
  }

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
}

// Rest of the code...
```

### 2.2 Create Steam-Specific Build Configuration

**Add to `package.json`**:
```json
"build": {
  "appId": "com.dorianbayart.pixelfortress",
  "productName": "Pixel Fortress",
  "icon": "assets/base_512_pixelated.png",
  "files": [
    "**/*",
    "!node_modules",
    "!package-lock.json",
    "!npm-debug.log",
    "!dist",
    "steam_appid.txt"
  ],
  "extraFiles": [
    {
      "from": "node_modules/steamworks.js/lib",
      "to": ".",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": "dir"
  },
  "mac": {
    "target": "dir"
  },
  "linux": {
    "target": "dir"
  }
}
```

**Note**: Steam distribution requires directory builds (not installers) because Steam handles installation.

### 2.3 Create steam_appid.txt
- [ ] Create `steam_appid.txt` in project root
- [ ] Add your Steam App ID (assigned by Steamworks after app creation)
```
480  # Replace with your actual Steam App ID
```

This file is only used for local testing. Steam client overrides it in production.

### 2.4 Update GitHub Actions for Steam Builds

Create `.github/workflows/steam-build.yml`:
```yaml
name: Steam Build

on:
  push:
    tags:
      - 'v*-steam'

jobs:
  build-steam:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20

    - name: Install dependencies
      run: npm install

    - name: Build for Steam
      run: npm run build:steam

    - name: Upload Steam build artifact
      uses: actions/upload-artifact@v4
      with:
        name: steam-build-${{ matrix.os }}
        path: dist/*
```

**Add to `package.json` scripts**:
```json
"scripts": {
  "build:steam": "electron-builder --dir"
}
```

---

## Phase 3: Steam Features Integration (Recommended)

### 3.1 Steam Achievements
Achievements significantly increase player engagement.

**Implementation Steps**:
- [ ] Design achievement list (15-30 achievements recommended)
- [ ] Create achievement icons (64x64px each)
- [ ] Configure achievements in Steamworks Partner dashboard
- [ ] Implement achievement tracking in game code

**Example Achievement Ideas**:
- "First Victory" - Win your first game
- "Resource Master" - Collect 10,000 of each resource
- "Builder" - Construct 50 buildings
- "Commander" - Control 100 units simultaneously
- "Survivor" - Win a game with less than 10% health remaining

**Code Example** (`js/steam.mjs`):
```javascript
export function unlockAchievement(achievementId) {
  if (greenworks) {
    greenworks.activateAchievement(achievementId,
      () => console.log(`Achievement unlocked: ${achievementId}`),
      (err) => console.error(`Achievement error: ${err}`)
    );
  }
}
```

### 3.2 Steam Cloud Saves
Allows players to sync save data across devices.

**Implementation**:
- [ ] Identify save files to sync (settings, progress, etc.)
- [ ] Configure Cloud Save paths in Steamworks
- [ ] Implement Cloud Save API calls

### 3.3 Steam Leaderboards
- [ ] Design leaderboard categories (e.g., fastest victory, highest score)
- [ ] Configure leaderboards in Steamworks
- [ ] Implement score submission

### 3.4 Steam Rich Presence
Shows what the player is doing in the game on their Steam profile.

**Example States**:
- "In Menu"
- "Building Fortress"
- "Battle in Progress"
- "Victory!"

### 3.5 Steam Workshop (Future Consideration)
For user-generated content like custom maps or mods.

---

## Phase 4: Steamworks Configuration

### 4.1 Create Steam App
- [ ] Log into Steamworks Partner
- [ ] Click "Apps & Packages" → "Create New App"
- [ ] Fill in basic information:
  - App Name: "Pixel Fortress"
  - App Type: Game
  - Target Release Date: TBD

### 4.2 Store Page Configuration
All fields required before release:

#### Marketing Assets
- [ ] **Header Capsule** (460x215px): Main store page image
- [ ] **Small Capsule** (231x87px): Search results, lists
- [ ] **Main Capsule** (616x353px): Featured spots
- [ ] **Hero Capsule** (1920x1080px): Store homepage hero
- [ ] **Library Assets**:
  - Library Capsule (600x900px)
  - Library Hero (3840x1240px)
  - Library Logo (1280x720px)
- [ ] **Screenshots**: Minimum 5 screenshots (1920x1080px or 3840x2160px)
- [ ] **Trailer Video**: Highly recommended (YouTube link)

#### Store Description
- [ ] **Short Description** (300 characters max): Brief game summary
- [ ] **Long Description** (Detailed, can use BBCode formatting)
- [ ] **About This Game**: Comprehensive game description
- [ ] **System Requirements**:
  - Minimum specs (OS, Processor, Memory, Graphics, Storage)
  - Recommended specs

**Example System Requirements**:
```
Minimum:
- OS: Windows 10, macOS 10.13, Ubuntu 18.04
- Processor: Intel Core i3 or equivalent
- Memory: 2 GB RAM
- Graphics: Integrated graphics with WebGL support
- Storage: 500 MB available space

Recommended:
- OS: Windows 11, macOS 13, Ubuntu 22.04
- Processor: Intel Core i5 or equivalent
- Memory: 4 GB RAM
- Graphics: Dedicated GPU
- Storage: 1 GB available space
```

#### Genre & Tags
- [ ] Select primary genre: Strategy
- [ ] Add tags: RTS, Tower Defense, Pixel Graphics, Indie, Singleplayer, Resource Management, Base Building, 2D

#### Pricing
- [ ] Set base price (typical indie games: $4.99 - $19.99)
- [ ] Configure regional pricing
- [ ] Plan launch discount (10-20% recommended)

#### Age Rating
- [ ] Complete content survey for age rating
- [ ] Likely rating: Everyone 10+ or Teen

### 4.3 Build Configuration

#### Depots Setup
Depots are the actual game files that Steam distributes.

- [ ] Create depot for Windows (Depot ID: auto-assigned)
- [ ] Create depot for macOS (Depot ID: auto-assigned)
- [ ] Create depot for Linux (Depot ID: auto-assigned)
- [ ] Set up depot build scripts

#### Example Depot Config (`windows_depot_build.vdf`):
```
"DepotBuildConfig"
{
  "DepotID" "YOUR_WINDOWS_DEPOT_ID"
  "ContentRoot" ".\\dist\\win-unpacked\\"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
}
```

### 4.4 Upload Builds Using SteamPipe

SteamPipe is Steam's content delivery system.

**Installation**:
- [ ] Download Steamworks SDK from Steamworks Partner
- [ ] Extract `steamcmd` and build tools

**Build Scripts** (`steam_build_scripts/`):
- [ ] Create `app_build.vdf` (main build config)
- [ ] Create `windows_depot_build.vdf`
- [ ] Create `macos_depot_build.vdf`
- [ ] Create `linux_depot_build.vdf`

**Example `app_build.vdf`**:
```
"AppBuild"
{
  "AppID" "YOUR_APP_ID"
  "Desc" "Pixel Fortress v32"
  "BuildOutput" ".\\output\\"
  "ContentRoot" ".\\dist\\"
  "SetLive" "default"

  "Depots"
  {
    "YOUR_WINDOWS_DEPOT_ID" "windows_depot_build.vdf"
    "YOUR_MACOS_DEPOT_ID" "macos_depot_build.vdf"
    "YOUR_LINUX_DEPOT_ID" "linux_depot_build.vdf"
  }
}
```

**Upload Command**:
```bash
steamcmd +login YOUR_STEAM_USERNAME +run_app_build .\\steam_build_scripts\\app_build.vdf +quit
```

---

## Phase 5: Testing

### 5.1 Local Testing
- [ ] Test game launch with `steam_appid.txt`
- [ ] Verify Steam overlay appears (Shift+Tab)
- [ ] Test achievement unlocking
- [ ] Test cloud saves synchronization

### 5.2 Steam Beta Testing
- [ ] Create beta branch in Steamworks
- [ ] Upload beta build
- [ ] Generate beta access keys
- [ ] Distribute to testers
- [ ] Collect and fix bugs
- [ ] Performance testing on various hardware

### 5.3 Pre-Release Checklist
- [ ] All store assets uploaded and approved
- [ ] At least one public build uploaded
- [ ] Pricing configured
- [ ] Age rating completed
- [ ] Tax/banking information complete
- [ ] 30-day review period completed (required by Steam)

---

## Phase 6: Launch & Post-Launch

### 6.1 Marketing Preparation
- [ ] Create Steam Community Hub content
- [ ] Post announcement on project GitHub
- [ ] Prepare launch trailer
- [ ] Reach out to gaming press/influencers
- [ ] Set up Discord/community channels
- [ ] Plan launch discount/bundle

### 6.2 Release
- [ ] Click "Release App" in Steamworks
- [ ] Monitor initial reviews and feedback
- [ ] Respond to community discussions
- [ ] Track analytics (wishlists, sales, playtime)

### 6.3 Post-Launch Maintenance
- [ ] Plan update schedule
- [ ] Create seasonal sales participation
- [ ] Implement community-requested features
- [ ] Create additional content/DLC
- [ ] Steam Trading Cards (optional, requires 10,000+ sales)

---

## Phase 7: Automation & CI/CD Integration

### 7.1 Automated Steam Uploads
- [ ] Create Steam Web API key
- [ ] Set up GitHub Actions secret for Steam credentials
- [ ] Automate depot uploads on version tags

### 7.2 Version Management
- [ ] Sync version between `package.json`, Steam, and GitHub releases
- [ ] Create unified versioning script
- [ ] Document version branching strategy

---

## Timeline Estimate

**Note**: Timeline estimates provided for planning purposes only.

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Prerequisites | 1-2 weeks | License change, account approval |
| Phase 2: Technical Integration | 2-3 weeks | Steamworks SDK, testing |
| Phase 3: Steam Features | 2-4 weeks | Optional but recommended |
| Phase 4: Steamworks Config | 1-2 weeks | Marketing assets, descriptions |
| Phase 5: Testing | 2-3 weeks | Beta testers, bug fixes |
| Phase 6: Launch | Ongoing | 30-day Steam review |
| **Total** | **8-14 weeks** | Assumes full-time work |

---

## Cost Breakdown

| Item | Cost (USD) | Notes |
|------|------------|-------|
| Steam Direct Fee | $100 | One-time, recoupable |
| Steamworks SDK | Free | - |
| Asset Licenses (if needed) | Varies | Check Merchant-Shade licenses |
| Marketing/PR (optional) | $0-$500+ | Trailer, press releases |
| **Total Minimum** | **$100** | Plus asset licenses if required |

---

## Resources & Documentation

### Official Steamworks Documentation
- [Steamworks Documentation](https://partner.steamgames.com/doc/home)
- [SteamPipe Build Deployment](https://partner.steamgames.com/doc/sdk/uploading)
- [Steam Achievements](https://partner.steamgames.com/doc/features/achievements)
- [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)

### Electron + Steam Resources
- [greenworks](https://github.com/greenheartgames/greenworks) - Steamworks bindings for Node.js/Electron
- [steamworks.js](https://github.com/ceifa/steamworks.js) - Modern Steamworks SDK for Node.js

### Community Resources
- r/gamedev - General game development advice
- r/SteamDev - Steam-specific developer discussions
- Steamworks Partner Forums - Official support

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ~~License incompatibility~~ | ~~**Critical**~~ | ✓ Resolved - Now using GPL-3.0-or-later |
| Asset licensing issues | **High** | Verify commercial rights for all assets |
| macOS signing | **Medium** | Need Apple Developer account ($99/year) |
| 30-day review delay | **Low** | Plan launch timing accordingly |
| Low initial sales | **Medium** | Marketing, community building, reviews |

---

## Next Steps

1. **HIGH PRIORITY**: Verify asset licenses for commercial use
2. **MEDIUM PRIORITY**: Create Steamworks Partner account
3. **MEDIUM PRIORITY**: Design marketing assets (capsules, screenshots)
4. **MEDIUM PRIORITY**: Document system requirements
5. **ONGOING**: Integrate Steamworks SDK and test locally

---

## Questions to Consider

- [ ] What will be the game's price point?
- [ ] Will there be a launch discount?
- [ ] Will you offer early access?
- [ ] Will you support Steam Workshop for user content?
- [ ] Will you create Steam Trading Cards (requires 10k+ sales)?
- [ ] Will you participate in Steam sales events?
- [ ] Will you offer regional pricing adjustments?

---

## Notes

- Steam takes a 30% revenue cut from all sales
- After first $10M in sales, the cut reduces to 25%, then 20% after $50M
- Payment processing fees (Valve handles this)
- You retain IP rights to your game
- Steam provides regional pricing suggestions
- Consider wishlisting campaign before launch (helps with initial sales)

---

**Document Version**: 1.1
**Last Updated**: 2026-01-21
**Status**: Planning Phase - License Issue Resolved
