// Materials and textures, all made in code: glossy ivory and black lacquer
// for the pieces, a polished maple-and-walnut board with a thin walnut frame
// and faint coordinates, soft glows for the highlights and the shadow under
// each piece. A small studio environment gives the gloss something to reflect.
import {
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PMREMGenerator,
  SRGBColorSpace,
} from "three";
import type { Material, Texture, WebGLRenderer } from "three";
// eslint-disable-next-line import/extensions
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Board layout (squares): 8 × 8 playing area and the frame around it. */
export const BOARD = {
  frame: 0.42,
  thickness: 0.22,
  half: 4,
};

export const ARLES = "#f4d968";

let env: Texture | null = null;

/** The studio reflection map (made once per renderer). */
export const studioEnvironment = (gl: WebGLRenderer) => {
  if (!env) {
    const pmrem = new PMREMGenerator(gl);
    env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    pmrem.dispose();
  }
  return env;
};

/**
 * The scene renders without tone mapping (so the camera picture stays true),
 * which lets bright highlights clip to flat white. The board and pieces get
 * their own soft roll-off instead (Khronos PBR Neutral, a little under 1:1),
 * so ivory keeps its shading and glints stay small.
 */
const EXPOSURE = 0.92;
/** Khronos PBR Neutral, inlined (the renderer leaves its own out). */
const NEUTRAL_GLSL = /* glsl */ `
vec3 chessNeutral( vec3 color ) {
  const float start = 0.76;
  const float desaturation = 0.15;
  float x = min( color.r, min( color.g, color.b ) );
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < start ) return color;
  float d = 1. - start;
  float newPeak = 1. - d * d / ( peak + d - start );
  color *= newPeak / peak;
  float g = 1. - 1. / ( desaturation * ( peak - newPeak ) + 1. );
  return mix( color, vec3( newPeak ), g );
}
`;

/* eslint-disable no-param-reassign */
const softHighlights = <T extends Material>(m: T): T => {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = `${NEUTRAL_GLSL}\n${shader.fragmentShader.replace(
      "#include <tonemapping_fragment>",
      `gl_FragColor.rgb = chessNeutral( gl_FragColor.rgb * ${EXPOSURE.toFixed(2)} );`,
    )}`;
  };
  m.customProgramCacheKey = () => "chess-neutral";
  return m;
};
/* eslint-enable no-param-reassign */

export const pieceMaterials = (envMap: Texture) => ({
  w: softHighlights(
    new MeshPhysicalMaterial({
      color: new Color("#d9cbb0"),
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      envMap,
      envMapIntensity: 0.45,
    }),
  ),
  b: softHighlights(
    new MeshPhysicalMaterial({
      color: new Color("#161514"),
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap,
      envMapIntensity: 1,
    }),
  ),
});

// A tiny seeded random, so the wood grain looks the same every time.
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

/** Grain lines over a rectangle: long wavy strokes along one direction. */
const grain = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  vertical: boolean,
  tone: string,
  rnd: () => number,
  lines: number,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const len = vertical ? h : w;
  const across = vertical ? w : h;
  for (let i = 0; i < lines; i += 1) {
    const o = rnd() * across;
    const amp = 1 + rnd() * 3;
    const freq = 0.004 + rnd() * 0.01;
    const phase = rnd() * 10;
    ctx.globalAlpha = 0.05 + rnd() * 0.12;
    ctx.strokeStyle = tone;
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    for (let t = 0; t <= len; t += 6) {
      const d =
        o +
        Math.sin(t * freq + phase) * amp +
        Math.sin(t * freq * 3.1) * amp * 0.3;
      if (vertical) {
        if (t === 0) ctx.moveTo(x + d, y + t);
        else ctx.lineTo(x + d, y + t);
      } else if (t === 0) ctx.moveTo(x + t, y + d);
      else ctx.lineTo(x + t, y + d);
    }
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * The board's top: 64 inlaid squares (maple and walnut, grain alternating),
 * a walnut frame, and the file letters and rank numbers on all four sides,
 * faint, each set reading from its own side.
 */
export const boardTopTexture = (gl: WebGLRenderer) => {
  const size = 1536;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const total = BOARD.half * 2 + BOARD.frame * 2;
  const px = size / total;
  const edge = BOARD.frame * px;
  const rnd = seeded(7);
  // Frame.
  ctx.fillStyle = "#2e1b10";
  ctx.fillRect(0, 0, size, size);
  grain(ctx, 0, 0, size, edge, false, "#120904", rnd, 40);
  grain(ctx, 0, size - edge, size, edge, false, "#120904", rnd, 40);
  grain(ctx, 0, 0, edge, size, true, "#120904", rnd, 40);
  grain(ctx, size - edge, 0, edge, size, true, "#120904", rnd, 40);
  // Squares.
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      // Canvas row 0 is rank 8: a8 is light, a1 dark.
      const light = (r + f) % 2 === 0;
      const x = edge + f * px;
      const y = edge + r * px;
      const g = ctx.createLinearGradient(x, y, x + px, y + px);
      if (light) {
        g.addColorStop(0, "#e2c89a");
        g.addColorStop(1, "#d4b885");
      } else {
        g.addColorStop(0, "#7d4f30");
        g.addColorStop(1, "#6c4127");
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, px, px);
      grain(
        ctx,
        x,
        y,
        px,
        px,
        (r + f) % 2 === 0,
        light ? "#9a7346" : "#2f170a",
        rnd,
        26,
      );
    }
  }
  // A thin inlay line between the squares and the frame.
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "#c9a56a";
  ctx.lineWidth = px * 0.025;
  ctx.strokeRect(
    edge - px * 0.04,
    edge - px * 0.04,
    px * 8 + px * 0.08,
    px * 8 + px * 0.08,
  );
  // Coordinates: letters along the near and far edges, numbers on the sides.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#e8d6b4";
  ctx.font = `600 ${Math.round(edge * 0.46)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const files = "abcdefgh";
  const label = (text: string, x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  for (let i = 0; i < 8; i += 1) {
    const c = edge + (i + 0.5) * px;
    // The canvas's top is the far (black) side; white reads from the bottom.
    label(files[i], c, size - edge / 2, 0);
    label(files[i], c, edge / 2, Math.PI);
    label(String(8 - i), edge / 2, c, 0);
    label(String(8 - i), size - edge / 2, c, Math.PI);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  return tex;
};

export const boardMaterials = (gl: WebGLRenderer, envMap: Texture) => {
  // Satin, not mirror: a soft sheen that never glares at any angle.
  const top = softHighlights(
    new MeshPhysicalMaterial({
      map: boardTopTexture(gl),
      roughness: 0.62,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
      envMap,
      envMapIntensity: 0.3,
    }),
  );
  const side = softHighlights(
    new MeshPhysicalMaterial({
      color: new Color("#2a180d"),
      roughness: 0.5,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMap,
      envMapIntensity: 0.4,
    }),
  );
  // BoxGeometry faces: +x, −x, +y (top), −y, +z, −z.
  return [side, side, top, side, side, side];
};

/** A square canvas texture drawn by `paint`. */
const canvasTexture = (
  size: number,
  paint: (ctx: CanvasRenderingContext2D, s: number) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

/** Soft round glow, white, for tinting. */
export const glowTexture = () =>
  canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

/** A soft-edged square, for the last-move and hint squares. */
export const squareTexture = () =>
  canvasTexture(128, (ctx, s) => {
    const pad = s * 0.04;
    ctx.shadowColor = "rgba(255,255,255,1)";
    ctx.shadowBlur = s * 0.06;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(pad, pad, s - pad * 2, s - pad * 2, s * 0.08);
    ctx.fill();
  });

/** A thin glowing ring, for the cursor and capture targets. */
export const ringTexture = () =>
  canvasTexture(128, (ctx, s) => {
    ctx.shadowColor = "rgba(255,255,255,1)";
    ctx.shadowBlur = s * 0.06;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  });

/** The soft shadow under a piece. */
export const shadowTexture = () =>
  canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(0,0,0,0.62)");
    g.addColorStop(0.4, "rgba(0,0,0,0.42)");
    g.addColorStop(0.75, "rgba(0,0,0,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

/** A flat, unlit, see-through material for a decal on the board. */
export const decal = (map: Texture, color: string, opacity: number) =>
  new MeshBasicMaterial({
    map,
    color: new Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
