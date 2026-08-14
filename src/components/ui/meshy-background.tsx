"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Nappe animée en WebGL2 — bruit fractal, domaine déformé, tourbillon central.
 *
 * Version maison du fond « meshy » : rouge Cuisina au lieu du bleu, ralenti,
 * et posé très bas en opacité. Derrière un écran de connexion, un fond doit
 * se remarquer sans jamais réclamer l'attention — on le voit bouger si on le
 * regarde, pas si on tape son mot de passe.
 */

/** Zoom du motif : plus petit = motif plus large, moins répétitif. */
const ZOOM_FACTOR = 0.3;

/** Amplitude de base de la déformation ondulée. */
const BASE_WAVE_AMPLITUDE = 0.2;

/** Part d'amplitude tirée du bruit, pour que la houle ne se répète pas. */
const RANDOM_WAVE_FACTOR = 0.15;

/** Fréquence de la déformation ondulée. */
const WAVE_FREQUENCY = 4.0;

/** Facteur temps interne à la déformation. */
const TIME_FACTOR = 0.25;

/** Force du tourbillon au centre. */
const BASE_SWIRL_STRENGTH = 1.2;

/** Cadence du tourbillon fin. */
const SWIRL_TIME_MULT = 5.0;

/** Tourbillon supplémentaire modulé par le bruit. */
const NOISE_SWIRL_FACTOR = 0.2;

/**
 * Octaves du bruit fractal. Six suffisent : au-delà, chaque octave pèse moins
 * d'un centième de l'amplitude et disparaît complètement sous l'opacité à
 * laquelle ce fond est affiché — on paierait le GPU pour rien.
 */
const FBM_OCTAVES = 6;

/**
 * Palette en 20 pas, du presque-noir au crème de la maison, en passant par
 * le rouge Cuisina #C1121F au douzième pas. Le pas le plus sombre est rendu
 * totalement transparent, pour que le fond de page respire au travers.
 */
const RED_PALETTE = [
  [0.02, 0.0, 0.0],
  [0.05, 0.01, 0.01],
  [0.09, 0.01, 0.02],
  [0.14, 0.02, 0.03],
  [0.19, 0.02, 0.04],
  [0.25, 0.03, 0.05],
  [0.31, 0.03, 0.06],
  [0.38, 0.04, 0.07],
  [0.45, 0.04, 0.08],
  [0.52, 0.05, 0.09],
  [0.59, 0.05, 0.1],
  [0.66, 0.06, 0.11],
  [0.76, 0.07, 0.12],
  [0.82, 0.15, 0.19],
  [0.87, 0.28, 0.3],
  [0.91, 0.42, 0.42],
  [0.94, 0.56, 0.54],
  [0.96, 0.7, 0.66],
  [0.98, 0.83, 0.78],
  [0.99, 0.93, 0.88],
];

/* — Shaders — */

function buildFragmentShader(): string {
  const octaves = Math.floor(FBM_OCTAVES);
  const palette = RED_PALETTE.map(
    (c) => `vec3(${c[0]}, ${c[1]}, ${c[2]})`,
  ).join(",\n  ");

  return `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;

#define NUM_COLORS 20

vec3 palette[NUM_COLORS] = vec3[](
  ${palette}
);

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float noise2D(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.792843 - 0.853734 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float freq = 1.0;
  for (int i = 0; i < ${octaves}; i++) {
    value += amplitude * noise2D(st * freq);
    freq *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;
  uv *= float(${ZOOM_FACTOR});

  float t = uTime * float(${TIME_FACTOR});

  float waveAmp = float(${BASE_WAVE_AMPLITUDE}) + float(${RANDOM_WAVE_FACTOR})
                  * noise2D(vec2(t, 27.7));

  uv.x += waveAmp * sin(uv.y * float(${WAVE_FREQUENCY}) + t);
  uv.y += waveAmp * sin(uv.x * float(${WAVE_FREQUENCY}) - t);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float swirlStrength = float(${BASE_SWIRL_STRENGTH})
                        * (1.0 - smoothstep(0.0, 1.0, r));

  angle += swirlStrength * sin(uTime + r * float(${SWIRL_TIME_MULT}));
  uv = vec2(cos(angle), sin(angle)) * r;

  float n = fbm(uv);
  n += float(${NOISE_SWIRL_FACTOR}) * sin(t + n * 3.0);

  float noiseVal = 0.5 * (n + 1.0);

  float idx = clamp(noiseVal, 0.0, 1.0) * float(NUM_COLORS - 1);
  int iLow = int(floor(idx));
  int iHigh = int(min(float(iLow + 1), float(NUM_COLORS - 1)));
  float f = fract(idx);

  vec3 color = mix(palette[iLow], palette[iHigh], f);

  // Le pas le plus sombre disparaît : le fond de page passe au travers.
  outColor = (iLow == 0 && iHigh == 0)
    ? vec4(color, 0.0)
    : vec4(color, 1.0);
}
`;
}

const VERTEX_SHADER = `#version 300 es
precision mediump float;

in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

function createShaderProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram | null {
  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, vsSource);
  if (!vertexShader) return null;

  const fragmentShader = compile(gl.FRAGMENT_SHADER, fsSource);
  if (!fragmentShader) {
    gl.deleteShader(vertexShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // Les shaders sont référencés par le programme : on peut les libérer ici.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Could not link WebGL program:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export default function MeshyBackground({
  children,
  className,
  /** Vitesse de la nappe. 1 = vitesse d'origine ; par défaut, au ralenti. */
  speed = 0.18,
  /** Opacité du calque. Assez basse pour rester un fond. */
  opacity = 0.14,
}: {
  children?: React.ReactNode;
  className?: string;
  speed?: number;
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
    if (!gl) {
      // Pas de WebGL2 : le calque reste vide, la page garde son fond.
      return;
    }

    const program = createShaderProgram(gl, VERTEX_SHADER, buildFragmentShader());
    if (!program) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolutionLoc = gl.getUniformLocation(program, "uResolution");
    const uTimeLoc = gl.getUniformLocation(program, "uTime");

    // Rendu à un pixel par point CSS : à cette opacité, le détail d'un écran
    // Retina est invisible, et le fond ne coûte plus que le quart des pixels.
    function resize() {
      const w = Math.max(1, Math.floor(canvas!.clientWidth));
      const h = Math.max(1, Math.floor(canvas!.clientHeight));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }

    function draw(seconds: number) {
      resize();
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform2f(uResolutionLoc, canvas!.width, canvas!.height);
      gl!.uniform1f(uTimeLoc, seconds);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    const start = performance.now();

    if (reduceMotion) {
      // Une seule image, figée sur un moment agréable de l'animation.
      draw(8);
    } else {
      const loop = () => {
        draw(((performance.now() - start) * 0.001) * speed);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      if (reduceMotion) draw(8);
    });
    observer.observe(canvas);

    return () => {
      // Sans cette annulation, la boucle survit au démontage et dessine dans
      // un programme déjà supprimé.
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
    };
  }, [speed]);

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
        style={{ opacity, background: "transparent" }}
      />
      {children}
    </div>
  );
}
