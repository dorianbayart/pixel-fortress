# Pixel Fortress — Game Reference

Complete stats for all buildings and units. All timings in milliseconds (ms). All ranges in tiles (1 tile = 16px).

---

## Resources

The game has **5 distinct resources**:

| Resource | Icon | How to obtain |
|----------|------|---------------|
| Wood     | 🪵   | Lumberjack workers harvest from trees |
| Stone    | 🪨   | Quarry miners extract from rocks |
| Water    | 💧   | Well workers collect from water sources |
| Gold     | 🏅   | Gold Mine workers mine from gold deposits |
| Money    | 💰   | Market sells other resources for money |

**Starting resources per player:** 15 Wood, 5 Stone, 5 Water, 0 Gold, 0 Money (+ enough to build the first Tent)

---

## Buildings

TILE_SIZE = 16px. All buildings are 1×1 tile unless noted.

### Resource Buildings

#### ⛺ Tent
Produces Peon workers continuously.

| Stat | Value |
|------|-------|
| HP | 200 |
| Cost | 50 Wood, 25 Water, 15 Money |
| Produces | Peon (every 10s) |
| Upgrade | +50 HP, −10% production time |

---

#### 🪓 Wood Hut (Lumberjack)
Converts a Peon into a LumberjackWorker. Must be placed next to trees.

| Stat | Value |
|------|-------|
| HP | 150 |
| Cost | 8 Wood |
| Max Workers | 1 (upgradable to 2) |
| Upgrade | +25 HP, +1 max worker |

---

#### 🪨 Quarry
Converts a Peon into a QuarryMiner. Must be placed on rock.

| Stat | Value |
|------|-------|
| HP | 150 |
| Cost | 20 Wood |
| Max Workers | 1 |
| Upgrade | +25 HP, −10% production time |

---

#### 🧱 Well
Converts a Peon into a WaterCarrier. Must be placed next to water.

| Stat | Value |
|------|-------|
| HP | 150 |
| Cost | 8 Wood, 20 Stone |
| Max Workers | 1 (upgradable to 2) |
| Upgrade | +25 HP, +1 max worker |

---

#### ⛏️ Gold Mine
Converts a Peon into a GoldMiner. Must be placed on gold ore.

| Stat | Value |
|------|-------|
| HP | 150 |
| Cost | 25 Wood, 15 Stone |
| Max Workers | 1 |
| Upgrade | +25 HP, −10% production time |

---

#### 🏦 Market
Automatically sells one resource for Money every 15 seconds. Configurable which resource to sell.

| Stat | Value |
|------|-------|
| HP | 100 |
| Cost | 25 Wood, 10 Water, 50 Stone, 15 Gold |
| Sells | 1 unit of chosen resource → 1 Money (every 15s) |
| Sellable resources | Wood, Water, Stone, Gold |
| Upgrade | +50 HP, +1 selling price per unit |

---

### Combat Buildings

#### ⚔️ Barracks
Trains Soldiers.

| Stat | Value |
|------|-------|
| HP | 50 |
| Cost | 15 Wood, 10 Water, 5 Gold |
| Produces | Soldier (every 12s) |
| Upgrade | +50 HP, −10% production time |

---

#### 🔮 Arcana
Trains Mages.

| Stat | Value |
|------|-------|
| HP | 120 |
| Cost | 20 Wood, 15 Stone, 10 Water, 25 Gold |
| Produces | Mage (every 20s) |
| Upgrade | +50 HP, −10% production time |

---

#### 🏹 Archery
Trains Archers.

| Stat | Value |
|------|-------|
| HP | 100 |
| Cost | 20 Wood, 10 Stone, 15 Water, 10 Gold |
| Produces | Archer (every 16s) |
| Upgrade | +50 HP, −10% production time |

---

#### 🛡️ Armory
Trains Heavy Infantry.

| Stat | Value |
|------|-------|
| HP | 150 |
| Cost | 25 Wood, 20 Water, 10 Money, 20 Gold |
| Produces | Heavy Infantry (every 20s) |
| Upgrade | +75 HP, −10% production time |

---

#### 🏰 Citadel
Trains Elite Warriors.

| Stat | Value |
|------|-------|
| HP | 250 |
| Cost | 40 Wood, 40 Water, 20 Money, 50 Gold |
| Produces | Elite Warrior (every 30s) |
| Upgrade | +100 HP, −10% production time |

---

### Defense Buildings

#### 🗼 Tower (Base)
Automatically attacks nearby enemies. Can be upgraded into one of three specializations.

| Stat | Value |
|------|-------|
| HP | 200 |
| Cost | 30 Wood, 40 Stone, 15 Gold |
| Attack Damage | 5 |
| Attack Range | 5 tiles |
| Attack Cooldown | 2000 ms (0.5 atk/s) |
| Visibility | 7 tiles |
| Branches | Bullet, Rapidfire, Farstrike |

---

#### 🗼 Bullet
Balanced — all-around stats. Upgraded from Tower.

| Stat | Base | Per Upgrade |
|------|------|-------------|
| HP | 230 | +50 |
| Attack Damage | 8 | +4 |
| Attack Range | 6 tiles | +1 tile |
| Attack Cooldown | 1200 ms (0.83 atk/s) | −10% |
| **Upgrade Cost** | 50 Wood, 60 Stone, 20 Gold → then 30 Wood, 40 Stone, 20 Gold | |

> DPS = 8 / 1.2s ≈ **6.7 damage/s**

---

#### 🗼 Rapidfire
Fast attacks, short range, lower damage. Upgraded from Tower.

| Stat | Base | Per Upgrade |
|------|------|-------------|
| HP | 170 | +30 |
| Attack Damage | 3 | +2 |
| Attack Range | 3 tiles | +0.5 tile |
| Attack Cooldown | 500 ms (2 atk/s) | −15% |
| **Upgrade Cost** | 40 Wood, 30 Stone, 20 Gold → then 20 Wood, 20 Stone, 15 Gold | |

> DPS = 3 / 0.5s = **6.0 damage/s**

---

#### 🎯 Farstrike
Slow but hits hard at extreme range. Upgraded from Tower.

| Stat | Base | Per Upgrade |
|------|------|-------------|
| HP | 250 | +75 |
| Attack Damage | 25 | +10 |
| Attack Range | 10 tiles | +2 tiles |
| Attack Cooldown | 4000 ms (0.25 atk/s) | −5% |
| **Upgrade Cost** | 30 Wood, 80 Stone, 40 Gold → then 20 Wood, 60 Stone, 30 Gold | |

> DPS = 25 / 4s = **6.25 damage/s**

---

## Units

All speeds are in tiles/second. Ranges are in tiles (1 tile = 16px).
Melee damage is applied continuously while in range; ranged damage is per projectile.

### Worker Units

All workers share the same base stats. Their specialist role determines what they gather.

| Stat | Value |
|------|-------|
| HP | 5 |
| Speed | 1 tile/s |
| Attack | 1 (melee, range 1 tile) |
| Carry capacity | 1 unit of resource |
| Gather rate | 0.2 units/s (5 seconds to fill) |

| Class | Role | Gathers | Produced by |
|-------|------|---------|-------------|
| Peon | Base worker | Nothing (manual tasks) | Tent (10s) |
| LumberjackWorker | Woodcutter | Wood | Wood Hut (instant conversion) |
| QuarryMiner | Stone miner | Stone | Quarry (instant conversion) |
| WaterCarrier | Water collector | Water | Well (instant conversion) |
| GoldMiner | Gold miner | Gold | Gold Mine (instant conversion) |

> Worker buildings convert an existing Peon into a specialist almost instantly (1s production cooldown).

---

### Combat Units

#### PeonSoldier
A Peon pressed into combat service. Weakest fighter.

| Stat | Value |
|------|-------|
| HP | 5 |
| Attack | 1 (melee) |
| Attack Range | 0.75 tiles |
| Speed | 1 tile/s |
| Produced by | — (converted in emergencies) |

---

#### ⚔️ Soldier
Standard melee fighter. Good balance of cost and effectiveness.

| Stat | Value |
|------|-------|
| HP | 12 |
| Attack | 5 (melee, continuous) |
| Attack Range | 0.75 tiles |
| Speed | 0.925 tile/s |
| Produced by | Barracks (12s) |

---

#### 🛡️ Heavy Infantry
High durability tank. Slow but very hard to kill.

| Stat | Value |
|------|-------|
| HP | 40 |
| Attack | 5 (melee, continuous) |
| Attack Range | 0.5 tiles (shorter than other melee) |
| Speed | 0.8 tile/s |
| Produced by | Armory (20s) |

---

#### 🗡️ Elite Warrior
High attack power. Best melee damage output.

| Stat | Value |
|------|-------|
| HP | 25 |
| Attack | 12 (melee, continuous) |
| Attack Range | 0.75 tiles |
| Speed | 0.85 tile/s |
| Produced by | Citadel (30s) |

---

#### 🔮 Mage
Ranged attacker firing animated fireballs. Burst damage with cooldown.

| Stat | Value |
|------|-------|
| HP | 8 |
| Attack | 12 per fireball |
| Attack Range | 5 tiles |
| Attack Cooldown | 2000 ms (0.5 fireball/s) |
| Speed | 0.8 tile/s |
| Produced by | Arcana (20s) |

> DPS ≈ 12 / 2s = **6.0 damage/s**. Fragile — low HP.

---

#### 🏹 Archer
Ranged attacker firing arrows. Good balance of speed, range, and survivability.

| Stat | Value |
|------|-------|
| HP | 10 |
| Attack | 8 per arrow |
| Attack Range | 5 tiles |
| Attack Cooldown | 1500 ms (0.67 arrow/s) |
| Speed | 1.0 tile/s |
| Produced by | Archery (16s) |

> DPS ≈ 8 / 1.5s = **5.33 damage/s**

---

## Unit Progression (XP System)

Combat units gain experience from kills and can level up:

- **Kills** grant +5 XP per kill
- **Level up** at `level × 10` XP
- **Per level:** +20% attack, +10% HP, XP resets to 0

---

## Game Mode Modifiers

| Mode | Effect |
|------|--------|
| **One Shot** | All units and buildings start with 1 HP |
| **Turbo Gathering** | Worker gather rates multiplied by 5× |

---

## Quick Comparison Tables

### Buildings — Cost Summary

| Building | Wood | Stone | Water | Gold | Money | HP |
|----------|------|-------|-------|------|-------|----|
| Tent | 50 | — | 25 | — | 15 | 200 |
| Wood Hut | 8 | — | — | — | — | 150 |
| Quarry | 20 | — | — | — | — | 150 |
| Well | 8 | 20 | — | — | — | 150 |
| Gold Mine | 25 | 15 | — | — | — | 150 |
| Barracks | 15 | — | 10 | 5 | — | 50 |
| Archery | 20 | 10 | 15 | 10 | — | 100 |
| Arcana | 20 | 15 | 10 | 25 | — | 120 |
| Armory | 25 | — | 20 | 20 | 10 | 150 |
| Citadel | 40 | — | 40 | 50 | 20 | 250 |
| Market | 25 | 50 | 10 | 15 | — | 100 |
| Tower | 30 | 40 | — | 15 | — | 200 |

### Units — Combat Summary

| Unit | HP | Attack | Range | Speed | Atk Cooldown | DPS |
|------|-----|--------|-------|-------|--------------|-----|
| Peon | 5 | 1 | 1 tile | 1.0 | continuous | 1.0 |
| PeonSoldier | 5 | 1 | 0.75 tile | 1.0 | 1000 ms | 1.0 |
| Soldier | 12 | 5 | 0.75 tile | 0.925 | 1000 ms | 5.0 |
| Heavy Infantry | 40 | 5 | 0.5 tile | 0.8 | 1000 ms | 5.0 |
| Elite Warrior | 25 | 12 | 0.75 tile | 0.85 | 1000 ms | 12.0 |
| Mage | 8 | 12/shot | 5 tiles | 0.8 | 2000 ms | 6.0 |
| Archer | 10 | 8/shot | 5 tiles | 1.0 | 1500 ms | 5.3 |

### Towers — Combat Summary

| Tower | HP | Attack | Range | Cooldown | DPS |
|-------|-----|--------|-------|----------|-----|
| Tower (base) | 200 | 5 | 5 tiles | 2000 ms | 2.5 |
| Bullet | 230 | 8 | 6 tiles | 1200 ms | 6.7 |
| Rapidfire | 170 | 3 | 3 tiles | 500 ms | 6.0 |
| Farstrike | 250 | 25 | 10 tiles | 4000 ms | 6.25 |
