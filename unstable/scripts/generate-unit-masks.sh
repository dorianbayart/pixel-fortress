#!/usr/bin/env bash
# =============================================================================
# generate-unit-masks.sh
#
# Generates grayscale player-color mask PNGs for all unit sprites and the
# punyworld-overworld-tileset.png (buildings).
#
# These masks are used by the PlayerColorFilter GLSL shader (js/playerColorFilter.mjs)
# to identify which pixels belong to the "player color zone" (hat, clothing, skin)
# versus non-colorable zones (armor, shadows, outlines).
#
# In each output mask:
#   White pixels  = player color zone (shader applies hue rotation here)
#   Black pixels  = non-colorable zone (shader leaves these unchanged)
#   Transparent   = matches the original sprite's transparent background
#
# Two generation strategies are used depending on available assets:
#
#   1. DIFF METHOD (preferred, most accurate)
#      Requires two color variants of the same unit (e.g. Cyan + Red).
#      Diffs the two images pixel-by-pixel — any pixel that changed between
#      the two variants is definitively a player-color pixel.
#
#   2. SATURATION METHOD (fallback for units with a single color variant)
#      Detects pixels with high color saturation in HSL space.
#      Works well for units whose player-color zone is clearly saturated
#      (e.g. bright green slime, vivid orange character base).
#      Tune the THRESHOLD value per unit as needed (0–100, lower = more pixels).
#
# Requirements: ImageMagick 7+ (magick command)
# Usage: bash scripts/generate-unit-masks.sh
#        Run from the project root directory.
# =============================================================================

set -euo pipefail

UNITS_DIR="./assets/units"

# -----------------------------------------------------------------------------
# Helper: diff-based mask (two color variants)
#   $1 = path to variant A (e.g. Cyan)
#   $2 = path to variant B (e.g. Red)
#   $3 = output mask path
#   $4 = "true" to also detect inherently cyan-hued pixels in img_a and OR
#        them into the mask (catches pixels that are the same cyan in both
#        variants and thus missed by the pure diff).
# -----------------------------------------------------------------------------
generate_diff_mask() {
  local img_a="$1"
  local img_b="$2"
  local out="$3"
  local detect_cyan="${4:-false}"

  magick "$img_a" "$img_b" \
    \( -clone 0,1 -compose Difference -composite -alpha off -threshold 1% \) \
    \( -clone 0 -alpha extract \) \
    -delete 0,1 \
    -compose CopyOpacity -composite \
    /tmp/pf_diff_mask.png

  if [ "$detect_cyan" = "true" ]; then
    # Detect pixels with cyan hue (H ≈ 180° → u.r ≈ 0.5 in HSL [0,1] space)
    # and non-trivial saturation (u.g > 0.30) to avoid flagging grey pixels.
    # These are player-color pixels that happen to share the same cyan color in
    # both variants, so the diff above misses them.
    magick "$img_a" \
      \( -clone 0 -colorspace HSL \
         -fx "u.r > 0.38 && u.r < 0.62 && u.g > 0.30 ? 1.0 : 0.0" \
         -colorspace sRGB \
      \) \
      \( -clone 0 -alpha extract \) \
      -delete 0 \
      -compose CopyOpacity -composite \
      /tmp/pf_cyan_detect.png

    # Merge: Lighten = pixel-wise max = logical OR for B&W images
    magick /tmp/pf_diff_mask.png /tmp/pf_cyan_detect.png \
      -compose Lighten -composite \
      "$out"

    echo "[diff+cyan]   $out"
  else
    cp /tmp/pf_diff_mask.png "$out"
    echo "[diff]        $out"
  fi
}

# -----------------------------------------------------------------------------
# Helper: saturation-based mask (single color variant, no reference)
#   $1 = path to input sprite
#   $2 = output mask path
#   $3 = saturation threshold % (0–100, lower catches more pixels)
# -----------------------------------------------------------------------------
generate_saturation_mask() {
  local img="$1"
  local out="$2"
  local threshold="${3:-20}"

  magick "$img" \
    \( -clone 0 -colorspace HSL -channel S -separate +channel -threshold "${threshold}%" \) \
    \( -clone 0 -alpha extract \) \
    -delete 0 \
    -compose CopyOpacity -composite \
    "$out"

  echo "[saturation ${threshold}%] $out"
}

# =============================================================================
# DIFF-BASED MASKS
# Units that exist in multiple color variants — most accurate method.
# The two variants must be of the same unit in different player colors.
# =============================================================================

generate_diff_mask \
  "$UNITS_DIR/Human-Soldier-Cyan.png" \
  "$UNITS_DIR/Human-Soldier-Red.png" \
  "$UNITS_DIR/Human-Soldier-Mask.png" \
  true

generate_diff_mask \
  "$UNITS_DIR/Human-Worker-Cyan.png" \
  "$UNITS_DIR/Human-Worker-Red.png" \
  "$UNITS_DIR/Human-Worker-Mask.png" \
  true

generate_diff_mask \
  "$UNITS_DIR/Mage-Cyan.png" \
  "$UNITS_DIR/Mage-Red.png" \
  "$UNITS_DIR/Mage-Mask.png" \
  true

generate_diff_mask \
  "$UNITS_DIR/Soldier-Red.png" \
  "$UNITS_DIR/Soldier-Blue.png" \
  "$UNITS_DIR/Soldier-Mask.png"
# Note: Soldier-Yellow.png is a third color variant of the same unit.
# The mask above already captures its player-color zone. No separate mask needed.

generate_diff_mask \
  "$UNITS_DIR/Warrior-Red.png" \
  "$UNITS_DIR/Warrior-Blue.png" \
  "$UNITS_DIR/Warrior-Mask.png"

generate_diff_mask \
  "$UNITS_DIR/Archer-Green.png" \
  "$UNITS_DIR/Archer-Purple.png" \
  "$UNITS_DIR/Archer-Mask.png"

generate_diff_mask \
  "$UNITS_DIR/Orc-Peon-Cyan.png" \
  "$UNITS_DIR/Orc-Peon-Red.png" \
  "$UNITS_DIR/Orc-Peon-Mask.png" \
  true

generate_diff_mask \
  "$UNITS_DIR/Orc-Soldier-Cyan.png" \
  "$UNITS_DIR/Orc-Soldier-Red.png" \
  "$UNITS_DIR/Orc-Soldier-Mask.png" \
  true

# =============================================================================
# SATURATION-BASED MASKS
# Units with only one color variant — no reference image to diff against.
# Threshold tuned per unit by inspecting HSL saturation of colored pixels.
#
# How to tune the threshold for a new unit:
#   Sample a known "player color" pixel:
#     magick <unit>.png -colorspace HSL -format "%[fx:p{X,Y}.g*100]%%" info:
#   Sample a known "armor/shadow" pixel in the same way.
#   Set the threshold between the two values (closer to the armor value).
# =============================================================================

# Character-Base: entirely orange/warm-toned body — full body is player color zone.
# Orange skin pixels: ~60–90% HSL saturation. Grey outline pixels: ~0–5%.
# Threshold 25% cleanly separates them.
generate_saturation_mask \
  "$UNITS_DIR/Character-Base.png" \
  "$UNITS_DIR/Character-Base-Mask.png" \
  25

# Orc-Grunt: dark grey stone armor (6% saturation) + vivid green skin (54–88% saturation).
# Threshold 20% catches all green skin while excluding grey armor.
generate_saturation_mask \
  "$UNITS_DIR/Orc-Grunt.png" \
  "$UNITS_DIR/Orc-Grunt-Mask.png" \
  20

# Slime: entire body is bright green — full body is player color zone.
generate_saturation_mask \
  "$UNITS_DIR/Slime.png" \
  "$UNITS_DIR/Slime-Mask.png" \
  20

# =============================================================================
# TILESET BUILDING MASK
# The punyworld-overworld-tileset.png contains two player-color variants of
# each building side-by-side:
#   Cyan buildings: tiles x=4..13, y=33..37  → pixels (64,528) to (223,607)
#   Red  buildings: tiles x=14..23, y=33..37 → pixels (224,528) to (383,607)
# Tile size: 16×16 px
#
# Strategy: diff the cyan and red regions → white pixels = player color zone.
# Also detect inherently cyan-hued pixels (H ≈ 180°, S > 30%) that are the
# same in both variants and thus missed by the diff.
# Output: a full-tileset-sized (432×1040) mask, all black except in the
# cyan building zone where player-color pixels are white.
# =============================================================================

TILESET="./assets/punyworld-overworld-tileset.png"
TILESET_MASK="./assets/punyworld-overworld-tileset-Mask.png"

# Extract the two 160×80 building color variants
magick "$TILESET" -crop 160x80+64+528 +repage /tmp/pf_cyan_buildings.png
magick "$TILESET" -crop 160x80+224+528 +repage /tmp/pf_red_buildings.png

# Step 1: diff-based mask (white = pixels that differ between variants)
magick /tmp/pf_cyan_buildings.png /tmp/pf_red_buildings.png \
  \( -clone 0,1 -compose Difference -composite -alpha off -threshold 1% \) \
  \( -clone 0 -alpha extract \) \
  -delete 0,1 \
  -compose CopyOpacity -composite \
  /tmp/pf_buildings_mask_region.png

# Step 2: cyan-hue detection (catches player-color pixels that are the same
# cyan color in both variants — e.g. window ornaments — so the diff misses them).
# H ≈ 0.5 in HSL [0,1] = 180° = cyan; keep hue range [0.38, 0.62] and S > 30%.
magick /tmp/pf_cyan_buildings.png \
  \( -clone 0 -colorspace HSL \
     -fx "u.r > 0.38 && u.r < 0.62 && u.g > 0.30 ? 1.0 : 0.0" \
     -colorspace sRGB \
  \) \
  \( -clone 0 -alpha extract \) \
  -delete 0 \
  -compose CopyOpacity -composite \
  /tmp/pf_buildings_cyan_detect.png

# Step 3: merge — Lighten = pixel-wise max = logical OR for B&W images
magick /tmp/pf_buildings_mask_region.png /tmp/pf_buildings_cyan_detect.png \
  -compose Lighten -composite \
  /tmp/pf_buildings_mask_merged.png

# Composite into a full-tileset-sized black canvas at the cyan building position
magick -size 432x1040 xc:black \
  /tmp/pf_buildings_mask_merged.png -geometry +64+528 -compose Over -composite \
  "$TILESET_MASK"

echo "[diff+cyan tileset] $TILESET_MASK"

echo ""
echo "Done. Generated masks:"
ls "$UNITS_DIR"/*-Mask.png
echo "$TILESET_MASK"
