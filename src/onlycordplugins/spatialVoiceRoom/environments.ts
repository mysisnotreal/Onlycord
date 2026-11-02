/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const ENVIRONMENT_INDEX: Record<string, number> = { midnight: 0, water: 1, meadow: 2, sunset: 3, space: 4, neon: 5, aurora: 6 };

export const VERTEX_SHADER = `#version 300 es
void main() {
    vec2 corner = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
    gl_Position = vec4(corner, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uScale;
uniform float uTime;
uniform int uEnv;
uniform vec3 uSeats[12];
uniform int uSeatCount;
out vec4 fragColor;

const float HORIZON = 0.32;
const float FLOOR = 0.64;
const float PERSPECTIVE = 1100.0;

bool hideBodies = false;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0, amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        amplitude *= 0.5;
    }
    return value;
}

float stars(vec2 p, float density) {
    vec2 cell = floor(p * density);
    vec2 offset = fract(p * density) - 0.5;
    float seed = hash(cell);
    if (seed < 0.92) return 0.0;
    vec2 center = (vec2(hash(cell + 1.7), hash(cell + 3.1)) - 0.5) * 0.7;
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.0 + seed * 3.0) + seed * 40.0);
    return smoothstep(0.09, 0.0, length(offset - center)) * (seed - 0.92) * 12.5 * twinkle;
}

vec3 seatTint() {
    if (uEnv == 0) return vec3(0.72, 0.8, 1.0);
    if (uEnv == 1) return vec3(0.45, 0.68, 1.0);
    if (uEnv == 2) return vec3(1.0, 0.92, 0.58);
    if (uEnv == 3) return vec3(1.0, 0.58, 0.28);
    if (uEnv == 4) return vec3(0.48, 0.58, 1.0);
    if (uEnv == 5) return vec3(1.0, 0.18, 0.74);
    return vec3(0.3, 1.0, 0.65);
}

vec3 sky(vec2 s) {
    float up = clamp(s.y / 0.7, 0.0, 1.0);
    if (uEnv == 0) {
        return vec3(0.012, 0.013, 0.018) + vec3(0.05, 0.055, 0.075) * exp(-s.y * 7.0) * exp(-s.x * s.x * 2.5);
    }
    if (uEnv == 1) {
        vec3 color = mix(vec3(0.05, 0.1, 0.2), vec3(0.008, 0.016, 0.05), pow(up, 0.6));
        color += stars(s, 34.0) * vec3(0.9, 0.95, 1.0) * smoothstep(0.02, 0.16, s.y);
        color += vec3(0.04, 0.05, 0.08) * smoothstep(0.42, 0.8, fbm(s * vec2(2.0, 5.0) + vec2(uTime * 0.012, 0.0)));
        vec2 moon = s - vec2(0.42, 0.2);
        float distance = length(moon);
        float surface = 0.8 + 0.2 * fbm(moon * 30.0);
        color = mix(color, vec3(0.98, 0.96, 0.86) * surface, smoothstep(0.066, 0.061, distance));
        color += vec3(0.28, 0.33, 0.48) * exp(-distance * 7.0);
        return color;
    }
    if (uEnv == 2) {
        vec3 color = mix(vec3(0.72, 0.86, 0.95), vec3(0.2, 0.47, 0.84), pow(up, 0.65));
        vec2 sun = s - vec2(-0.55, 0.22);
        color += vec3(1.0, 0.9, 0.68) * (exp(-length(sun) * 3.6) * 0.45 + smoothstep(0.052, 0.044, length(sun)));
        float clouds = fbm(s * vec2(2.6, 7.0) + vec2(uTime * 0.018, 0.0));
        color = mix(color, vec3(1.0), smoothstep(0.48, 0.74, clouds) * 0.92);
        float hills = 0.05 + 0.055 * fbm(vec2(s.x * 2.6, 3.0)) + 0.012 * sin(s.x * 7.0);
        color = mix(color, vec3(0.27, 0.42, 0.33), smoothstep(hills + 0.004, hills - 0.004, s.y));
        return color;
    }
    if (uEnv == 3) {
        vec3 color = mix(vec3(1.0, 0.56, 0.24), vec3(0.72, 0.22, 0.42), smoothstep(0.0, 0.26, s.y));
        color = mix(color, vec3(0.11, 0.08, 0.3), smoothstep(0.2, 0.72, s.y));
        vec2 sun = s - vec2(0.0, 0.1);
        color += vec3(1.0, 0.6, 0.26) * exp(-length(sun) * 3.6) * 0.55;
        color = mix(color, vec3(1.0, 0.88, 0.58), smoothstep(0.1, 0.092, length(sun)));
        color = mix(color, vec3(0.98, 0.5, 0.48), smoothstep(0.5, 0.72, fbm(s * vec2(1.4, 11.0) + vec2(uTime * 0.01, 0.0))) * 0.6);
        float dunes = 0.024 + 0.05 * fbm(vec2(s.x * 2.2 + 8.0, 1.0));
        color = mix(color, vec3(0.2, 0.08, 0.13), smoothstep(dunes + 0.003, dunes - 0.003, s.y));
        return color;
    }
    if (uEnv == 4) {
        float nebula = fbm(s * 2.2 + vec2(uTime * 0.006, 0.0) + fbm(s * 3.0));
        vec3 color = vec3(0.008, 0.008, 0.024);
        color += vec3(0.32, 0.08, 0.46) * smoothstep(0.42, 0.85, nebula);
        color += vec3(0.04, 0.2, 0.42) * smoothstep(0.5, 0.9, fbm(s * 3.0 + 9.0));
        color += (stars(s, 28.0) + stars(s + 4.0, 62.0) * 0.6) * vec3(0.95, 0.97, 1.0);
        if (hideBodies) return color;
        vec2 planet = s - vec2(-0.5, 0.2);
        float radius = length(planet);
        vec3 body = mix(vec3(0.03, 0.06, 0.16), vec3(0.42, 0.6, 0.86), smoothstep(-0.1, 0.14, planet.x + planet.y));
        body *= 0.72 + 0.34 * fbm(planet * vec2(9.0, 34.0));
        color = mix(color, body, smoothstep(0.135, 0.13, radius));
        color += vec3(0.28, 0.5, 1.0) * exp(-abs(radius - 0.135) * 40.0) * 0.5;
        return color;
    }
    if (uEnv == 5) {
        vec3 color = mix(vec3(0.72, 0.1, 0.56), vec3(0.04, 0.012, 0.15), smoothstep(0.0, 0.5, s.y));
        color += stars(s, 30.0) * smoothstep(0.08, 0.32, s.y);
        vec2 sun = s - vec2(0.0, 0.13);
        float disc = smoothstep(0.125, 0.12, length(sun));
        float gap = sun.y < 0.03 ? smoothstep(0.42, 0.46, fract(sun.y * (24.0 - sun.y * 60.0) + uTime * 0.12)) : 0.0;
        color = mix(color, mix(vec3(1.0, 0.16, 0.5), vec3(1.0, 0.86, 0.26), smoothstep(-0.11, 0.11, sun.y)), disc * (1.0 - gap));
        color += vec3(0.9, 0.16, 0.5) * exp(-length(sun) * 4.2) * 0.3;
        if (hideBodies) return color;
        float tooth = abs(fract(s.x * 2.6) - 0.5) * 2.0;
        float ridges = 0.012 + smoothstep(0.2, 0.95, abs(s.x)) * (0.1 * tooth + 0.08 * noise(vec2(s.x * 6.0, 2.0)));
        color = mix(color, vec3(0.03, 0.012, 0.09), smoothstep(ridges + 0.002, ridges - 0.002, s.y));
        color += vec3(0.0, 0.8, 1.0) * exp(-abs(s.y - ridges) * 220.0) * step(0.2, abs(s.x)) * 0.55;
        return color;
    }
    vec3 color = mix(vec3(0.05, 0.1, 0.17), vec3(0.008, 0.012, 0.04), pow(up, 0.55));
    color += stars(s, 34.0) * smoothstep(0.03, 0.22, s.y);
    float wave = s.x * 2.2 + 1.3 * fbm(vec2(s.x * 1.3 + uTime * 0.035, uTime * 0.02));
    float curtain = pow(0.5 + 0.5 * sin(wave * 3.4), 3.0) * smoothstep(0.03, 0.2, s.y) * smoothstep(0.7, 0.2, s.y);
    float rays = 0.55 + 0.45 * noise(vec2(s.x * 38.0 + uTime * 0.25, s.y * 2.0));
    color += mix(vec3(0.07, 0.95, 0.5), vec3(0.55, 0.2, 0.95), smoothstep(0.1, 0.5, s.y)) * curtain * rays * 0.85;
    return color;
}

vec3 ground(vec2 g, float k, vec2 s) {
    if (uEnv == 0) {
        vec3 color = vec3(0.008, 0.008, 0.012);
        color += vec3(0.11, 0.12, 0.16) * exp(-dot(g, g) * 0.55);
        return color + 0.012 * fbm(g * 7.0) * exp(-k * 0.25);
    }
    if (uEnv == 1) {
        vec2 q = g * vec2(5.0, 13.0);
        float t = uTime * 0.5;
        vec2 flow = vec2(t, t * 0.6);
        float height = fbm(q + flow) + 0.5 * fbm(q * 2.3 - flow * 1.3);
        float e = 0.04;
        float dx = fbm(q + vec2(e, 0.0) + flow) - fbm(q - vec2(e, 0.0) + flow);
        float dy = fbm(q + vec2(0.0, e) + flow) - fbm(q - vec2(0.0, e) + flow);
        vec2 normal = vec2(dx, dy) * 3.0;
        for (int i = 0; i < uSeatCount; i++) {
            vec2 away = g - uSeats[i].xy;
            float reach = length(away);
            float strength = 0.014 + uSeats[i].z * 0.075;
            normal += (away / max(reach, 0.001)) * sin(reach * 48.0 - uTime * (3.0 + uSeats[i].z * 4.0)) * exp(-reach * 3.4) * strength;
        }
        vec2 mirrored = vec2(s.x + normal.x * 0.14, -s.y * 0.9 + abs(normal.y) * 0.06);
        vec3 reflected = sky(mirrored);
        float fresnel = 0.32 + 0.68 * pow(clamp(k * 0.42, 0.0, 1.0), 2.0);
        vec3 color = mix(vec3(0.005, 0.03, 0.06), reflected, fresnel);
        float column = exp(-pow((s.x - 0.42 + normal.x * 0.3) * 7.5, 2.0));
        float glint = smoothstep(0.018, 0.075, normal.y) * smoothstep(0.03, 0.0, abs(normal.x));
        color += vec3(0.95, 0.92, 0.78) * column * (glint * 1.5 + 0.05);
        return color + vec3(0.012, 0.024, 0.04) * height;
    }
    if (uEnv == 2) {
        float wind = fbm(g * 0.55 + vec2(uTime * 0.2, uTime * 0.1));
        vec2 blade = g + vec2(sin(uTime * 1.4 + g.y * 2.0) * 0.012 + (wind - 0.5) * 0.03, 0.0);
        float strands = noise(blade * vec2(190.0, 95.0)) * 0.55 + noise(blade * vec2(420.0, 210.0)) * 0.45;
        float near = exp(-k * 0.55);
        vec3 color = mix(vec3(0.13, 0.36, 0.1), vec3(0.42, 0.66, 0.2), fbm(g * 0.8));
        color *= mix(1.0, 0.45 + strands * 1.05, near);
        color += vec3(0.1, 0.13, 0.03) * smoothstep(0.48, 0.72, wind);
        vec2 cell = floor(g * 11.0);
        float flower = step(0.965, hash(cell)) * smoothstep(0.09, 0.03, length(fract(g * 11.0) - 0.5)) * near;
        vec3 petal = hash(cell + 2.0) > 0.5 ? vec3(1.0, 0.94, 0.42) : vec3(0.98, 0.5, 0.74);
        return mix(color, petal, flower);
    }
    if (uEnv == 3) {
        float shape = fbm(g * 0.7);
        float ripples = 0.5 + 0.5 * sin(g.y * 34.0 + g.x * 9.0 + shape * 16.0);
        vec3 color = mix(vec3(0.62, 0.29, 0.17), vec3(0.96, 0.57, 0.3), shape);
        color *= 0.9 + 0.13 * ripples * exp(-k * 0.5);
        return color + vec3(0.4, 0.17, 0.05) * exp(-pow(s.x * 2.6, 2.0));
    }
    if (uEnv == 4) {
        hideBodies = true;
        vec3 color = sky(vec2(s.x, -s.y * 1.2)) * 0.48 + vec3(0.012, 0.014, 0.03);
        hideBodies = false;
        float radial = abs(fract(length(g) * 2.4 - uTime * 0.05) - 0.5);
        return color + vec3(0.16, 0.28, 0.65) * smoothstep(0.016, 0.0, radial) * exp(-k * 0.7) * exp(-dot(g, g) * 0.1);
    }
    if (uEnv == 5) {
        vec2 q = g * 3.4 + vec2(0.0, uTime * 0.45);
        vec2 width = fwidth(q) * 1.4;
        vec2 lines = smoothstep(width + 0.018, vec2(0.0), abs(fract(q) - 0.5));
        float line = max(lines.x, lines.y);
        hideBodies = true;
        vec3 color = sky(vec2(s.x, -s.y * 0.6)) * 0.22 + vec3(0.016, 0.004, 0.05);
        hideBodies = false;
        return color + mix(vec3(0.0, 0.85, 1.0), vec3(1.0, 0.14, 0.72), clamp(k * 0.25, 0.0, 1.0)) * line * 0.9;
    }
    float drift = fbm(g * 0.9);
    vec3 color = mix(vec3(0.34, 0.44, 0.6), vec3(0.74, 0.84, 0.95), drift);
    color += sky(vec2(s.x, -s.y)) * 0.28;
    vec2 cell = floor(g * vec2(90.0, 180.0));
    float sparkle = step(0.985, hash(cell)) * smoothstep(0.4, 0.0, length(fract(g * vec2(90.0, 180.0)) - 0.5));
    return color + vec3(0.9) * sparkle * (0.5 + 0.5 * sin(uTime * 2.2 + hash(cell + 3.0) * 30.0)) * exp(-k * 0.7);
}

void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y * uScale - gl_FragCoord.y) / uScale;
    float horizonY = HORIZON * uSize.y;
    vec2 s = vec2(p.x - uSize.x * 0.5, horizonY - p.y) / uSize.y;
    vec3 color;
    if (s.y > 0.0) {
        color = sky(s);
    } else {
        float k = (FLOOR - HORIZON) * uSize.y / (p.y - horizonY);
        vec2 g = vec2((p.x - uSize.x * 0.5) * k, PERSPECTIVE * (1.0 - k)) / uSize.y;
        float haze = 1.0 - exp(-k * k * 0.018);
        color = ground(g, k, s);
        float contact = uEnv == 2 || uEnv == 3 || uEnv == 6 ? 0.62 : 0.3;
        for (int i = 0; i < uSeatCount; i++) {
            vec2 away = g - uSeats[i].xy;
            float reach = dot(away, away);
            color += seatTint() * exp(-reach * 6.0) * (0.045 + uSeats[i].z * 0.42);
            color *= 1.0 - contact * exp(-reach * 42.0);
        }
        hideBodies = true;
        color = mix(color, sky(vec2(s.x, 0.012)), haze);
    }

    hideBodies = true;
    float mist = exp(-abs(s.y) * 19.0) * (0.35 + 0.65 * fbm(vec2(s.x * 2.6 + uTime * 0.03, s.y * 8.0)));
    color = mix(color, sky(vec2(s.x, 0.03)) * 1.15 + seatTint() * 0.015, mist * 0.55);

    color *= 1.12;
    color = clamp(color * (2.51 * color + 0.03) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    color = pow(color, vec3(0.88)) + (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
    fragColor = vec4(color, 1.0);
}`;

export const FOREGROUND_SHADER = `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uScale;
uniform float uTime;
uniform int uEnv;
uniform vec3 uSeats[12];
uniform int uSeatCount;
out vec4 fragColor;

const float HORIZON = 0.32;
const float FLOOR = 0.64;
const float PERSPECTIVE = 1100.0;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float falling(vec2 p, float density, float speed, float size) {
    p.y -= uTime * speed;
    p.x += sin(p.y * 2.0 + uTime * 0.3) * 0.08;
    vec2 cell = floor(p * density);
    vec2 offset = fract(p * density) - 0.5;
    vec2 center = (vec2(hash(cell + 2.3), hash(cell + 5.9)) - 0.5) * 0.8;
    float pulse = 0.6 + 0.4 * sin(uTime * (0.7 + hash(cell) * 2.0) + hash(cell + 7.0) * 20.0);
    return smoothstep(size, size * 0.15, length(offset - center)) * step(0.45, hash(cell)) * pulse;
}

vec3 seatTint() {
    if (uEnv == 0) return vec3(0.72, 0.8, 1.0);
    if (uEnv == 1) return vec3(0.45, 0.68, 1.0);
    if (uEnv == 2) return vec3(1.0, 0.92, 0.58);
    if (uEnv == 3) return vec3(1.0, 0.58, 0.28);
    if (uEnv == 4) return vec3(0.48, 0.58, 1.0);
    if (uEnv == 5) return vec3(1.0, 0.18, 0.74);
    return vec3(0.3, 1.0, 0.65);
}

vec3 rays(vec2 s, vec2 source, vec3 color, float amount) {
    vec2 toward = s - source;
    float angle = atan(toward.y, toward.x);
    float shafts = noise(vec2(angle * 7.0, uTime * 0.05)) * 0.6 + noise(vec2(angle * 19.0, uTime * 0.09)) * 0.4;
    return color * pow(shafts, 2.6) * exp(-length(toward) * 2.5) * amount * smoothstep(0.05, 0.16, length(toward));
}

void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y * uScale - gl_FragCoord.y) / uScale;
    float height = uSize.y;
    float center = uSize.x * 0.5;
    float horizonY = HORIZON * height;
    float floorY = FLOOR * height;
    vec2 s = vec2(p.x - center, horizonY - p.y) / height;
    vec2 screen = p / height;
    vec3 light = vec3(0.0);

    if (uEnv == 1) light += rays(s, vec2(0.42, 0.2), vec3(0.6, 0.7, 1.0), 0.32);
    if (uEnv == 2) light += rays(s, vec2(-0.55, 0.22), vec3(1.0, 0.93, 0.7), 0.55);
    if (uEnv == 3) light += rays(s, vec2(0.0, 0.1), vec3(1.0, 0.62, 0.3), 0.6);
    if (uEnv == 5) light += rays(s, vec2(0.0, 0.13), vec3(1.0, 0.25, 0.65), 0.28);

    float beam = uEnv == 0 ? 0.13 : uEnv == 2 || uEnv == 3 ? 0.012 : 0.05;
    for (int i = 0; i < uSeatCount; i++) {
        float scale = PERSPECTIVE / (PERSPECTIVE - uSeats[i].y * height);
        float seatX = center + uSeats[i].x * height * scale;
        float seatY = horizonY + (floorY - horizonY) * scale;
        if (p.y < seatY) {
            float along = p.y / seatY;
            float beamX = mix(center + (seatX - center) * 0.4, seatX, along);
            float width = height * mix(0.012, 0.125 * scale, along);
            float offset = (p.x - beamX) / width;
            light += seatTint() * exp(-offset * offset) * along * smoothstep(1.0, 0.86, along) * (beam + uSeats[i].z * 0.2);
        }
    }

    if (uEnv == 6) light += vec3(0.95) * (falling(screen, 7.0, 0.08, 0.05) * 0.8 + falling(screen + 3.0, 15.0, 0.05, 0.055) * 0.42);
    if (uEnv == 3) light += vec3(1.0, 0.72, 0.42) * falling(screen * vec2(0.4, 1.0), 30.0, -0.015, 0.07) * 0.25;
    if (uEnv == 2) light += vec3(0.82, 1.0, 0.45) * falling(screen, 11.0, -0.012, 0.04) * 0.75 * smoothstep(0.0, 0.25, -s.y);
    if (uEnv == 1) light += vec3(0.65, 0.85, 1.0) * falling(screen, 16.0, -0.008, 0.025) * 0.35;
    if (uEnv == 0) light += vec3(0.55) * falling(screen, 18.0, 0.008, 0.03) * 0.28;
    if (uEnv == 5) light += vec3(0.2, 0.9, 1.0) * falling(screen, 14.0, -0.03, 0.022) * 0.5;

    vec2 centered = p / uSize - 0.5;
    float vignette = clamp(dot(centered, centered) * 1.05 - 0.04, 0.0, 0.62);
    float grain = hash(gl_FragCoord.xy + fract(uTime)) * 0.016;
    fragColor = vec4(light + grain, vignette);
}`;
