# Homepage Redesign Plan

## Overview

This document outlines the plan to transform `index.html` from a game entry point into a beautiful marketing landing page, while moving the actual game to `play.html`.

**Completed**: `index.html` is now a dedicated marketing landing page, game is in `play.html`

---

## Goals

1. ✅ **Create a Beautiful Landing Page** that showcases Pixel Fortress professionally
2. ✅ **Separate Concerns**: Marketing page vs. game application
3. ✅ **Clear Value Proposition**: Free version features clearly explained, Steam version coming soon
4. ✅ **Multiple CTAs**: Play Now (Web), Steam Coming Soon, View on GitHub
5. ✅ **SEO Optimization**: Better discoverability with accurate meta tags
6. ✅ **Mobile Responsive**: Works on all devices
7. ✅ **Fast Loading**: Minimal assets on landing page
8. ✅ **Open Source Transparency**: Highlight GPL v3 and open source nature

---

## Implemented Site Structure

```
pixel-fortress/
├── index.html                  # ✅ Marketing landing page
├── play.html                   # ✅ Game entry point (original index.html)
├── js/
│   ├── landing.js              # ✅ Landing page interactions
│   └── ...                     # Game JavaScript modules
├── css/
│   ├── landing.css             # ✅ Landing page styles
│   └── modal.css               # Game modal styles
├── assets/                     # Game assets
├── lib/                        # PixiJS library
├── maps/                       # Map data
└── plans/                      # Planning documents
```

---

## Landing Page Design

### Visual Style

**Design Philosophy**: Pixel art aesthetic, forest/fortress theme, retro gaming vibe

**Color Palette**:
- Primary: Forest green (#228b22)
- Accent: Gold (#ffd700)
- Background: Dark gradient (#1a1a1a to #228b22)
- Text: White, Gold
- Borders: Gold with glow effects

**Typography**:
- Headings: "Jacquarda Bastarda 9" (game font)
- Body: System fonts
- Pixel art aesthetic maintained throughout

---

## Implemented Content

### Hero Section
- **Tagline**: "Build Smart. Let Them Fight."
- **Subtitle**: "100% Open Source Auto-Battler"
- **Genre**: "Base Building • Automated Strategy • Pixel Art"
- **CTAs**:
  - "Play Free Now" → play.html
  - "Wishlist on Steam (Soon)" → #pricing section

### Features Section (6 cards)
1. **Strategic Base Building** - Choose what and where to build
2. **Fully Automated Combat** - Units operate completely autonomously
3. **AI Opponents** - Up to 3 AI with difficulty levels (Easy, Normal, Hard)
4. **Diverse Maps** - Procedural generation (3 sizes) + predefined scenarios
5. **Dynamic Exploration** - Units auto-explore, fog of war reveals strategically
6. **Specialized Unit Types** - Workers, gatherers, soldiers, heavy infantry, elite warriors

### Pricing Section
**Free Version**:
- ✅ Core gameplay
- ✅ Play in browser or desktop
- ✅ Single-player vs AI
- ✅ Multiple difficulty levels
- ✅ Random maps (3 sizes)
- ✅ Selected predefined maps
- ✅ All current units and buildings
- ✅ Full source code (GPL v3)
- ⚠️ Local save progression only (desktop apps)

**Steam Premium** (Coming Soon):
- ✅ Everything in Free version
- 🌟 Full campaign mode (planned)
- 🌟 Extensive additional premium maps
- 🌟 Exclusive game modes
- 🌟 Map editor (planned)
- 🌟 Steam achievements
- 🌟 Cloud save progression
- 🌟 Auto-updates & Steam integration
- 🌟 Support continued development

### Key Messaging
- Game is an **auto-battler**, not an RTS
- Units are **fully autonomous** - no direct control
- Strategy is about **what and where you build**
- Steam version is **in development** - no release date announced
- Free version has **selected** predefined maps, Steam will have **extensive additional** maps

---

## Assets Needed (Phase 6)

### New Assets to Create

1. **Gameplay Screenshots** (4-6 images)
   - Format: WebP (with PNG fallback)
   - Size: 1280x720px
   - Content:
     - Base building view
     - Combat in action
     - Resource gathering operations
     - Map exploration (fog of war)
     - Large map overview
     - AI opponent base

2. **Open Graph Image** (`og-image.png`)
   - Format: PNG
   - Size: 1200x630px
   - Content: Logo + "Pixel Fortress" + "Build Smart. Let Them Fight." tagline
   - For social media sharing (Discord, Twitter, etc.)

3. **Feature Icons** (Optional - currently using emoji)
   - Pixel art icons 64x64px
   - Could replace emoji in feature cards

4. **Platform Icons** (Optional - currently using emoji)
   - Pixel art icons 128x128px
   - Browser, Steam, GitHub, Desktop

### Existing Assets (Already in Use)

- ✅ `assets/base_512_pixelated.png` - Logo (hero + nav)
- ✅ `favicon.png` - Favicon
- ✅ Font: "Jacquarda Bastarda 9" - Already loaded

---

## Implementation Timeline

### ✅ Phase 1: Structure Setup (COMPLETED)
- [x] Create `play.html` (copy original `index.html`)
- [x] Test `play.html` works identically
- [x] Verify all game functionality works

### ✅ Phase 2: Landing Page HTML (COMPLETED)
- [x] Create new `index.html` with all sections
- [x] Add semantic HTML structure
- [x] Add meta tags and SEO elements
- [x] Insert all content sections

### ✅ Phase 3: Landing Page CSS (COMPLETED)
- [x] Create `css/landing.css`
- [x] Implement all section styles
- [x] Add responsive breakpoints
- [x] Polish animations and hover effects

### ✅ Phase 4: Landing Page JavaScript (COMPLETED)
- [x] Create `js/landing.js`
- [x] Implement FAQ accordion toggle
- [x] Implement smooth scrolling
- [x] Implement mobile menu toggle
- [x] Add scroll reveal animations
- [x] Add hero particle effects
- [x] Add button ripple effects

### ✅ Phase 5: Content Writing (COMPLETED)
- [x] Write all section copy
- [x] Update feature descriptions (accurate to game)
- [x] Write FAQ answers
- [x] Update all "RTS" references to "Auto-battler"
- [x] Update Steam messaging to "Coming Soon"
- [x] Ensure consistent tone

### 🔲 Phase 6: Asset Creation (TODO)
- [ ] Take 4-6 gameplay screenshots
- [x] Create Open Graph image (1200x630px)
- [ ] Optimize all images (WebP conversion)
- [ ] Add alt text to all images
- [ ] Optional: Create pixel art icons

### 🔲 Phase 7: Testing (TODO)
- [ ] Test on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test on tablet
- [ ] Verify all links work
- [ ] Test FAQ accordion functionality
- [ ] Test mobile menu toggle
- [ ] Test responsive breakpoints
- [ ] Verify SEO meta tags
- [ ] Test page load speed
- [ ] Validate HTML/CSS

### 🔲 Phase 8: Polish & Launch (TODO)
- [ ] Final review of all content
- [ ] Compress images if needed
- [ ] Consider minifying CSS/JS (optional)
- [ ] Consider adding analytics (privacy-friendly)
- [ ] Update README.md to mention new landing page
- [ ] Commit and deploy
- [ ] Submit sitemap to search engines (optional)

---

## Migration Checklist

### ✅ Completed

- [x] Backup original `index.html`
- [x] Test original game functionality
- [x] Copy `index.html` to `play.html`
- [x] Verify `play.html` works identically
- [x] Create new `index.html` (landing page)
- [x] Create `css/landing.css`
- [x] Create `js/landing.js`
- [x] Test both pages independently
- [x] Test navigation between pages

### 🔲 Post-Launch Tasks

- [ ] Update README.md with landing page info
- [ ] Update any documentation referencing `index.html` as game entry
- [ ] Consider announcing new landing page
- [ ] Monitor analytics (if implemented)

---

## Analytics & Tracking (Optional)

### Recommended Privacy-Friendly Options

- **Plausible Analytics** - Open source, privacy-friendly
- **Simple Analytics** - Privacy-friendly
- **Umami** - Self-hosted, open source

### Metrics to Track (if implemented)

**Landing Page**:
- Page views
- CTA click rates ("Play Free Now")
- Scroll depth
- Time on page

**Conversion Funnels**:
- Landing → Play (free)
- Landing → GitHub (contributors)

**Note**: Avoid heavy tracking that conflicts with open source ethos.

---

## Future Enhancements (Post-Launch)

### Content Additions
- [ ] Gameplay video/trailer in preview section
- [ ] Dev blog integration
- [ ] Community showcase (maps/screenshots)
- [ ] Testimonials/reviews

### Features
- [ ] Steam Widget (when Steam page is live)
- [ ] Live GitHub stats (stars/forks)
- [ ] Changelog page
- [ ] Roadmap visualization
- [ ] Localization (translate landing page)

### Polish
- [ ] Dark mode toggle
- [ ] More animated backgrounds
- [ ] Screenshot lightbox gallery

---

## Success Metrics (Goals)

### Traffic (First Month)
- 1000+ page views
- 50%+ click "Play Now"
- 5%+ visit GitHub

### Engagement
- Average time: 2+ minutes
- Bounce rate: <60%
- Scroll depth: 60%+ reach pricing

### Conversions
- 500+ free game sessions
- +50 GitHub stars
- Strong community engagement

---

## Related Documents

- **[LICENSING_BUSINESS_MODEL.md](LICENSING_BUSINESS_MODEL.md)** - Freemium model details
- **[STEAM_DEPLOYMENT.md](STEAM_DEPLOYMENT.md)** - Steam launch plan
- **[ROADMAP.md](ROADMAP.md)** - Development roadmap
- **[CLAUDE.md](../CLAUDE.md)** - Project instructions and architecture

---

## Important Notes

### What This Game IS
- **Auto-battler** with strategic base-building
- **Automated strategy** - units operate autonomously
- Strategy comes from **what and where you build**
- No direct unit control - design and deploy

### What This Game is NOT
- **Not an RTS** - no micromanagement or direct commands
- **Not ready for Steam** - Steam version is planned but in development
- **Not a traditional tower defense** - more active than TD

### Content Guidelines
- Emphasize **automation** and **strategic depth without stress**
- Use tagline: "Build Smart. Let Them Fight."
- Always mention it's **100% open source** (GPL v3)
- Be honest about Steam being **in development**
- Highlight the **autonomous unit system** as the core mechanic

---

**Document Version**: 2.0
**Last Updated**: 2026-01-22
**Status**: Phases 1-5 Complete, Phase 6-8 Pending
**Next Step**: Phase 6 - Asset Creation (screenshots and OG image)
