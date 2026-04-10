# Business Model — Pixel Fortress

## Strategy Overview

**Goal**: Release on Itch.io as a free browser game to validate player interest,
gather feedback, and build an audience before a paid Steam release.

This is a proven path for open-source strategy/automation games.

---

## Comparable Games

| Game | Model | Outcome |
|---|---|---|
| **Shapez.io** | Free web + free itch → paid Steam ($3.99) | $1M+ Steam revenue; itch players bought it again |
| **Mindustry** | Free itch (PWYW) + paid Steam + Patreon | Major success, 100k+ positive reviews, GPL like us |
| **Unciv** | Free everywhere + paid Google Play | Sustainable income from convenience purchases |

**Key insight**: Pixel Fortress fits this pattern almost exactly — browser RTS, GPL,
not yet commercial. The itch audience and Steam audience have low overlap;
free itch does **not** cannibalize Steam sales.

---

## Phase 1 — Itch.io Launch (Validation)

### Deployment
- Publish as a **browser-playable** game (not download-only)
  - Browser games get ~6x more plays than download-only (37% vs 6% play rate)
- Pricing: **"$0 or Donate"** with a suggested amount of $2–$5
- Genre/tags: RTS, Strategy, Automation, Browser, Open Source

### What to Measure
- **Play count** — proxy for "would people try this on Steam?"
- **Ratings and comments** — direct feedback on what to improve
- **Donation conversion** — secondary signal of enthusiasm
- **Session length** — are players actually engaging?

### Realistic Expectations
- Donation conversion on browser games: **< 1%** (players bypass the payment screen)
- Average donation if it happens: ~$3–5
- Organic itch.io traffic is near zero without active promotion
- Traffic drivers: game jams, social posts, being featured on itch.io

---

## Donation Strategy

Use **three stacked approaches** — each targets a different audience:

### 1. Itch.io "$0 or Donate" (primary)
**Setup**: Set suggested price at $3, minimum $0.
**Why**: Any payment adds the game to the player's itch library, building visible
social proof via the "owners" counter. 90% revenue share.
**Caveat**: Browser game players often bypass the payment screen entirely.

### 2. Ko-fi (in game description)
**Setup**: Add a Ko-fi link prominently in the itch.io description.
**Why**: Zero fees on one-time donations. Lower friction for players who want to
support but won't go through itch's payment flow. Recognized by indie game players.
**Example copy**: *"Enjoying the game? A Ko-fi goes a long way ☕"*

### 3. GitHub Sponsors (on repo)
**Setup**: Enable GitHub Sponsors on the repository.
**Why**: Technical users who find the game via GitHub are far more likely to donate
than casual players. GitHub waives fees.

### Skip for Now
- **Patreon** — requires monthly content commitment; better once established audience exists
- **PayPal direct** — less trust than Ko-fi; tax/accounting friction; Ko-fi is strictly better

---

## Traffic & Visibility Tactics

Itch.io organic discovery is minimal without effort. Proven tactics:

1. **Join game jams** — strategy/RTS themed jams provide a guaranteed audience spike
   and surface the game in jam browse pages
2. **Social media** — `#ScreenshotSaturday`, `#indiegame`, genre Discord servers
3. **Reddit** — r/IndieGaming, r/StrategyGames, r/opensourcegames
4. **Devlogs on itch.io** — regular updates improve algorithm placement
5. **"New & Popular" algorithm** — early engagement velocity matters; coordinate
   a release announcement to concentrate plays in the first few days

---

## Phase 2 — Steam Release

Once itch.io validates player interest:

- Create a **Steam page early** (even before launch) to start wishlist accumulation
- Link to the Steam wishlist from the itch.io page and GitHub README
- Pricing target: **$3.99–$4.99** (consistent with Shapez.io / Mindustry tier)
- The itch audience acts as "taste makers" who surface good games
- See `LICENSING_BUSINESS_MODEL.md` for the full freemium feature flag implementation
- See `STEAM_DEPLOYMENT.md` for the Steam technical deployment guide

---

## Summary

| Platform | Pricing | Purpose |
|---|---|---|
| Itch.io (browser) | $0 or donate (suggest $3) | Validate, gather feedback, build audience |
| Ko-fi | One-time donations | Supporters who bypass itch payment |
| GitHub Sponsors | Recurring/one-time | Technical audience, open source supporters |
| Steam | $3.99–$4.99 (paid) | Monetization, full release |

**The real value of itch.io at this stage is not revenue — it is validation.**

---

*Last updated: 2026-03-20*
