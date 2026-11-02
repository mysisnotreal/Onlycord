/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { findByCodeLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, ApplicationStreamPreviewStore, FluxDispatcher, MediaEngineStore, SelectedChannelStore, useEffect, useRef, UserStore, useState, useStateFromStores, VoiceStateStore } from "@webpack/common";
import type { CSSProperties, MouseEvent, RefObject } from "react";

import { ENVIRONMENT_INDEX, FOREGROUND_SHADER, FRAGMENT_SHADER, VERTEX_SHADER } from "./environments";
import { settings } from "./settings";

const cl = classNameFactory("vc-spatial-room-");
const logger = new Logger("SpatialVoiceRoom");

const SpeakingStore: { isSpeaking(userId: string): boolean; } & Parameters<typeof useStateFromStores>[0][number] = findStoreLazy("SpeakingStore");
const watchStream: (stream: object, options: { noFocus: boolean; forceMultiple: boolean; }) => void = findByCodeLazy('type:"STREAM_WATCH"');

const RADIUS = 1.6;
const LISTENER_Z = RADIUS * 1.2;
const MAX_TILT = 42;
const MAX_FPS = 30;
const MAX_SEATS = 12;
const SETTING_KEYS: ("environment" | "quality" | "showStreams")[] = ["environment", "quality", "showStreams"];

interface SceneState {
    environment: string;
    quality: number;
    users: string[];
}

export function seatPosition(index: number, count: number) {
    const angle = Math.PI / count + (2 * Math.PI * index) / count;
    return { x: RADIUS * Math.sin(angle), z: RADIUS * Math.cos(angle) };
}

export function listenerRelativePosition(index: number, count: number) {
    const { x, z } = seatPosition(index, count);
    return { x, y: 0, z: z - LISTENER_Z };
}

export function usersInCall() {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    return channelId ? Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId)).sort() : [];
}

function createProgram(gl: WebGL2RenderingContext, fragmentSource: string) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    return program;
}

function useShaderLayer(canvasRef: RefObject<HTMLCanvasElement | null>, source: string, transparent: boolean, sceneRef: RefObject<SceneState>) {
    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas?.getContext("webgl2", { alpha: transparent, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
        const program = gl && createProgram(gl, source);
        if (!canvas || !gl || !program) return;

        const parallel = gl.getExtension("KHR_parallel_shader_compile");
        const location = (name: string) => gl.getUniformLocation(program, name);
        const uniforms = { size: location("uSize"), scale: location("uScale"), time: location("uTime"), env: location("uEnv"), seats: location("uSeats"), count: location("uSeatCount") };
        const levels = new Map<string, number>();
        const seatData = new Float32Array(MAX_SEATS * 3);
        let ready = false;
        let frame = 0;
        let lastDraw = 0;

        const draw = (now: number) => {
            frame = requestAnimationFrame(draw);
            if (document.hidden || now - lastDraw < 1000 / MAX_FPS) return;
            if (!ready) {
                if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) return;
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    logger.error("Shader failed to link", gl.getProgramInfoLog(program));
                    cancelAnimationFrame(frame);
                    return;
                }
                gl.useProgram(program);
                ready = true;
            }
            lastDraw = now;

            const { environment, quality, users } = sceneRef.current;
            const width = canvas.clientWidth, height = canvas.clientHeight;
            const drawWidth = Math.round(width * quality), drawHeight = Math.round(height * quality);
            if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
                canvas.width = drawWidth;
                canvas.height = drawHeight;
                gl.viewport(0, 0, drawWidth, drawHeight);
            }

            const crowded = users.length > 4;
            const seatSize = Math.min(width * (crowded ? 0.105 : 0.14), height * (crowded ? 0.18 : 0.24));
            const count = Math.min(users.length, MAX_SEATS);
            for (let i = 0; i < count; i++) {
                const { x, z } = seatPosition(i, users.length);
                const level = levels.get(users[i]) ?? 0;
                const next = level + ((SpeakingStore.isSpeaking(users[i]) ? 1 : 0) - level) * 0.18;
                levels.set(users[i], next);
                seatData.set([x * seatSize * 1.5 / height, z * seatSize * 1.5 / height, next], i * 3);
            }

            gl.uniform2f(uniforms.size, width, height);
            gl.uniform1f(uniforms.scale, quality);
            gl.uniform1f(uniforms.time, now / 1000);
            gl.uniform1i(uniforms.env, ENVIRONMENT_INDEX[environment]);
            gl.uniform3fv(uniforms.seats, seatData);
            gl.uniform1i(uniforms.count, count);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        frame = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(frame);
            gl.getExtension("WEBGL_lose_context")?.loseContext();
        };
    }, []);
}

function useStreamVideo(userId: string) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        const attach = () => {
            const video = videoRef.current;
            if (!video) return;
            const source = [...document.querySelectorAll<HTMLVideoElement>(`[data-selenium-video-tile="${userId}"] video`)].find(v => v.srcObject)?.srcObject ?? null;
            if (video.srcObject !== source) video.srcObject = source;
            setHasVideo(!!source);
        };
        attach();
        const timer = setInterval(attach, 1000);
        return () => clearInterval(timer);
    }, [userId]);

    return { videoRef, hasVideo };
}

function MutedIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4ZM5 10a1 1 0 0 1 2 0v1a5 5 0 0 0 10 0v-1a1 1 0 1 1 2 0v1a7 7 0 0 1-6 6.93V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 11v-1Z" />
            <path stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M4 3l16 18" />
        </svg>
    );
}

function DeafenedIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a7 7 0 0 1 14 0h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9Z" />
            <path stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M4 3l16 18" />
        </svg>
    );
}

function StreamCard({ userId, isCamera, onFocus }: { userId: string; isCamera: boolean; onFocus(userId: string): void; }) {
    const { videoRef, hasVideo } = useStreamVideo(userId);
    const isSelf = userId === UserStore.getCurrentUser().id;
    const stream = useStateFromStores([ApplicationStreamingStore], () => ApplicationStreamingStore.getAnyStreamForUser(userId));
    const preview = useStateFromStores([ApplicationStreamPreviewStore], () => stream && !isCamera ? ApplicationStreamPreviewStore.getPreviewURL(stream.guildId, stream.channelId, userId) : null);

    const onClick = () => {
        if (hasVideo) onFocus(userId);
        else if (stream && !isSelf) watchStream(stream, { noFocus: true, forceMultiple: true });
    };

    return (
        <div className={cl("stream", { waiting: !hasVideo })} onClick={onClick} style={!hasVideo && preview ? { backgroundImage: `url("${preview}")` } : undefined}>
            <video ref={videoRef} className={cl("video")} style={{ display: hasVideo ? undefined : "none" }} autoPlay muted playsInline />
            {!hasVideo && <div className={cl("watch")}>{isSelf ? "Preview paused" : "Click to watch"}</div>}
            <div className={cl("live")}>{isCamera ? "CAMERA" : "LIVE"}</div>
        </div>
    );
}

function FocusedStream({ userId, onClose }: { userId: string; onClose(): void; }) {
    const { videoRef } = useStreamVideo(userId);
    const stream = useStateFromStores([ApplicationStreamingStore], () => ApplicationStreamingStore.getAnyStreamForUser(userId));
    const isSelf = userId === UserStore.getCurrentUser().id;

    const stopWatching = (event: MouseEvent) => {
        event.stopPropagation();
        if (stream) {
            const streamKey = stream.guildId ? `guild:${stream.guildId}:${stream.channelId}:${userId}` : `call:${stream.channelId}:${userId}`;
            FluxDispatcher.dispatch({ type: "STREAM_CLOSE", streamKey, canShowFeedback: false });
        }
        onClose();
    };

    return (
        <div className={cl("focus")} onClick={onClose}>
            <video ref={videoRef} className={cl("video")} autoPlay muted playsInline />
            {stream && !isSelf && <button className={cl("stop")} onClick={stopWatching}>Stop watching</button>}
        </div>
    );
}

function openDiscordMenu(event: MouseEvent, userId: string) {
    event.preventDefault();
    const tile = [...document.querySelectorAll(`[data-selenium-video-tile="${userId}"]`)].at(-1);
    (tile?.querySelector('[role="button"]') ?? tile)?.dispatchEvent(new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: event.clientX,
        clientY: event.clientY
    }));
}

function Seat({ userId, index, count, showStreams, onFocus }: { userId: string; index: number; count: number; showStreams: boolean; onFocus(userId: string): void; }) {
    const user = useStateFromStores([UserStore], () => UserStore.getUser(userId));
    const speaking = useStateFromStores([SpeakingStore], () => SpeakingStore.isSpeaking(userId));
    const state = useStateFromStores([VoiceStateStore], () => VoiceStateStore.getVoiceStateForUser(userId));
    const localMuted = useStateFromStores([MediaEngineStore], () => MediaEngineStore.isLocalMute(userId));
    if (!user) return null;

    const deafened = !!(state?.deaf || state?.selfDeaf);
    const muted = !!(state?.mute || state?.selfMute || localMuted);
    const live = showStreams && !!(state?.selfStream || state?.selfVideo);
    const { x, z } = seatPosition(index, count);
    const avatar = { backgroundImage: `url("${user.getAvatarURL(undefined, 256)}")` };

    return (
        <div
            className={cl("seat", { speaking, silent: muted || deafened })}
            style={{ "--x": x, "--z": z, "--tilt": `${-MAX_TILT * x / RADIUS}deg`, "--order": index } as CSSProperties}
        >
            <div className={cl("reflection")} style={avatar} />
            <div className={cl("body")}>
                <div className={cl("above")}>
                    {live && <StreamCard userId={userId} isCamera={!state?.selfStream} onFocus={onFocus} />}
                    <div className={cl("name")}>{user.globalName || user.username}</div>
                </div>
                <div className={cl("avatar")} style={avatar} onContextMenu={event => openDiscordMenu(event, userId)} />
                {(muted || deafened) && (
                    <div className={cl("badges")}>
                        {muted && <div className={cl("badge", { server: state?.mute })}><MutedIcon /></div>}
                        {deafened && <div className={cl("badge", { server: state?.deaf })}><DeafenedIcon /></div>}
                    </div>
                )}
            </div>
        </div>
    );
}

export const Room = ErrorBoundary.wrap(() => {
    const { environment, quality, showStreams } = settings.use(SETTING_KEYS);
    const users = useStateFromStores([VoiceStateStore, SelectedChannelStore], usersInCall, [], (a, b) => a.join() === b.join());
    const [focused, setFocused] = useState<string | null>(null);

    const sceneRef = useRef<SceneState>({ environment, quality, users });
    sceneRef.current = { environment, quality, users };
    const backgroundRef = useRef<HTMLCanvasElement>(null);
    const foregroundRef = useRef<HTMLCanvasElement>(null);
    useShaderLayer(backgroundRef, FRAGMENT_SHADER, false, sceneRef);
    useShaderLayer(foregroundRef, FOREGROUND_SHADER, true, sceneRef);

    return (
        <>
            <canvas ref={backgroundRef} className={cl("environment")} />
            <svg className={cl("filters")} aria-hidden="true">
                <filter id="vc-spatial-room-ripple">
                    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.07" numOctaves={2} seed={4}>
                        <animate attributeName="baseFrequency" dur="9s" values="0.012 0.07;0.016 0.09;0.012 0.07" repeatCount="indefinite" />
                    </feTurbulence>
                    <feDisplacementMap in="SourceGraphic" scale={13} />
                </filter>
            </svg>
            <div className={cl("world", { crowded: users.length > 4 })} data-environment={environment}>
                {users.map((userId, index) => <Seat key={userId} userId={userId} index={index} count={users.length} showStreams={showStreams} onFocus={setFocused} />)}
            </div>
            <canvas ref={foregroundRef} className={cl("environment", "foreground")} />
            {focused && users.includes(focused) && <FocusedStream userId={focused} onClose={() => setFocused(null)} />}
        </>
    );
}, { noop: true });
