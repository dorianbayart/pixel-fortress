/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export { PlayerColorFilter, hexToHue }

'use strict'

import * as PIXI from 'pixijs'

// ---------------------------------------------------------------------------
// Vertex shader — exact copy of PixiJS v8 default filter vertex shader
// ---------------------------------------------------------------------------
const vertexSrc = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  out vec2 vNormCoord;      // aPosition passed through — always [0,1] across the sprite quad

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition( void )
  {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

      return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord( void )
  {
      return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void)
  {
      gl_Position = filterVertexPosition();
      vTextureCoord = filterTextureCoord();
      vNormCoord    = aPosition;
  }
`

// ---------------------------------------------------------------------------
// Fragment shader – mask-based HSL hue rotation
// ---------------------------------------------------------------------------
const fragmentSrc = `
  in vec2 vTextureCoord;
  in vec2 vNormCoord;     // [0,1] across the sprite quad — resolution-independent
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform sampler2D uMaskSampler;

  // Flat uniform — UniformGroup uses ubo:false (default), so no block syntax
  uniform float uHue;

  // UV transform: xy = offset, zw = scale — maps vNormCoord [0,1]
  // to the sprite's sub-region within the full mask PNG source.
  uniform vec4 uMaskUVTransform;

  // RGB (linear, 0-1) → HSL  (H: 0-360, S: 0-1, L: 0-1)
  vec3 rgb2hsl(vec3 c) {
    float maxC  = max(c.r, max(c.g, c.b));
    float minC  = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float l     = (maxC + minC) * 0.5;
    float h     = 0.0;
    float s     = 0.0;

    if (delta > 0.001) {
      s = delta / (1.0 - abs(2.0 * l - 1.0));

      if (maxC == c.r) {
        h = mod((c.g - c.b) / delta, 6.0);
      } else if (maxC == c.g) {
        h = (c.b - c.r) / delta + 2.0;
      } else {
        h = (c.r - c.g) / delta + 4.0;
      }
      h *= 60.0;
      if (h < 0.0) h += 360.0;
    }

    return vec3(h, s, l);
  }

  // HSL (H: 0-360, S: 0-1, L: 0-1) → RGB (0-1)
  vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
    float m = l - c * 0.5;

    vec3 rgb;
    if      (h < 60.0)  rgb = vec3(c, x, 0.0);
    else if (h < 120.0) rgb = vec3(x, c, 0.0);
    else if (h < 180.0) rgb = vec3(0.0, c, x);
    else if (h < 240.0) rgb = vec3(0.0, x, c);
    else if (h < 300.0) rgb = vec3(x, 0.0, c);
    else                rgb = vec3(c, 0.0, x);

    return rgb + m;
  }

  void main(void) {
    vec4 base = texture(uTexture, vTextureCoord);

    // vNormCoord = aPosition = [0,1] across the sprite quad regardless of renderer
    // resolution. Use it to map the sprite frame to the correct sub-region of the
    // full mask PNG (which may have a different size than the render texture).
    vec2 maskUV = uMaskUVTransform.xy + vNormCoord * uMaskUVTransform.zw;
    vec4 mask = texture(uMaskSampler, maskUV);

    // Pass-through: transparent pixels or un-masked areas
    if (base.a < 0.01 || mask.r < 0.5) {
      finalColor = base;
      return;
    }

    // Un-premultiply alpha before HSL conversion
    vec3 straight = base.rgb / base.a;

    // Replace hue, keep saturation and luminance
    vec3 hsl    = rgb2hsl(straight);
    hsl.x       = uHue;
    vec3 newRgb = hsl2rgb(hsl);

    // Re-apply premultiplied alpha
    finalColor = vec4(newRgb * base.a, base.a);
  }
`

// ---------------------------------------------------------------------------
// Helper: 0xRRGGBB hex integer → HSL hue in degrees (0–360)
// ---------------------------------------------------------------------------
/**
 * Converts a 0xRRGGBB hex integer to the HSL hue of that colour (0–360°).
 * @param {number} hex - Colour as 0xRRGGBB integer (e.g. 0x00BFBF)
 * @returns {number} Hue in degrees
 */
function hexToHue(hex) {
  const r = ((hex >> 16) & 0xff) / 255
  const g = ((hex >> 8)  & 0xff) / 255
  const b = ( hex        & 0xff) / 255

  const maxC  = Math.max(r, g, b)
  const minC  = Math.min(r, g, b)
  const delta = maxC - minC

  if (delta === 0) return 0

  let h
  if (maxC === r) {
    h = ((g - b) / delta) % 6
  } else if (maxC === g) {
    h = (b - r) / delta + 2
  } else {
    h = (r - g) / delta + 4
  }

  h *= 60
  if (h < 0) h += 360
  return h
}

// ---------------------------------------------------------------------------
// PlayerColorFilter — PixiJS v8 Filter subclass
// ---------------------------------------------------------------------------
/**
 * PixiJS Filter that applies a hue-rotation shader to the masked zone of a
 * unit sprite, tinting that zone with the owning player's colour while
 * leaving all other pixels (armour, skin, shadows) unchanged.
 *
 * Usage:
 *   const filter = new PlayerColorFilter(maskTexture, 0x00BFBF)
 *   sprite.filters = [filter]
 *
 *   // Later, update colour without recreating the filter:
 *   filter.color = 0xCC2222
 */
class PlayerColorFilter extends PIXI.Filter {
  /**
   * @param {PIXI.Texture} maskTexture - Grayscale mask PNG; white = player-coloured zone
   * @param {number} playerHex         - Player colour as 0xRRGGBB integer
   */
  constructor(maskTexture, playerHex) {
    const glProgram = PIXI.GlProgram.from({
      vertex:   vertexSrc,
      fragment: fragmentSrc,
    })

    super({
      glProgram,
      resources: {
        uMaskSampler:   maskTexture.source,
        colorUniforms:  new PIXI.UniformGroup({
          uHue:              { value: hexToHue(playerHex), type: 'f32' },
          uMaskUVTransform:  { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
        }),
      },
    })

    this._colorHex = playerHex
  }

  /**
   * Update the player colour at runtime (no shader recompilation needed).
   * @param {number} hex - New colour as 0xRRGGBB integer
   */
  set color(hex) {
    this._colorHex = hex
    this.resources.colorUniforms.uniforms.uHue = hexToHue(hex)
  }

  /** @returns {number} Current colour as 0xRRGGBB integer */
  get color() {
    return this._colorHex
  }

  /**
   * Set the UV transform so the mask is sampled at the correct sub-region of the
   * full mask PNG, matching the sprite's current animation frame.
   *
   * @param {number} offsetX - U offset of the frame within the mask PNG (0–1)
   * @param {number} offsetY - V offset of the frame within the mask PNG (0–1)
   * @param {number} scaleX  - U scale  of the frame within the mask PNG (0–1)
   * @param {number} scaleY  - V scale  of the frame within the mask PNG (0–1)
   */
  setMaskUV(offsetX, offsetY, scaleX, scaleY) {
    const t = this.resources.colorUniforms.uniforms.uMaskUVTransform
    t[0] = offsetX
    t[1] = offsetY
    t[2] = scaleX
    t[3] = scaleY
  }
}
