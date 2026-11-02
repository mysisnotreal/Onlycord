/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OnlycordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import managedStyle from "./style.css?managed";

const TRACKPAD_DELTA = 30;
const LINE_HEIGHT = 40;

const settings = definePluginSettings({
    floatServerList: {
        type: OptionType.BOOLEAN,
        description: "Float the server list.",
        default: true,
        onChange: applyStyle
    },
    floatSidebar: {
        type: OptionType.BOOLEAN,
        description: "Float the channel and DM sidebar, and your account panel.",
        default: true,
        onChange: applyStyle
    },
    floatContent: {
        type: OptionType.BOOLEAN,
        description: "Float the main chat area.",
        default: true,
        onChange: applyStyle
    },
    roundness: {
        type: OptionType.SLIDER,
        description: "How round the floating panels are.",
        markers: [0, 4, 8, 12, 16, 20, 24, 32],
        default: 16,
        stickToMarkers: false,
        onChange: applyStyle
    },
    gap: {
        type: OptionType.SLIDER,
        description: "Space around the floating panels.",
        markers: [0, 4, 8, 12, 16, 24],
        default: 8,
        stickToMarkers: false,
        onChange: applyStyle
    },
    smoothScrolling: {
        type: OptionType.BOOLEAN,
        description: "Make all mouse wheel scrolling smooth.",
        default: true
    },
    scrollDuration: {
        type: OptionType.SLIDER,
        description: "How long smooth scrolling glides, in milliseconds.",
        markers: [50, 100, 150, 200, 300, 400],
        default: 150,
        stickToMarkers: false
    }
});

function applyStyle() {
    const { floatServerList, floatSidebar, floatContent, roundness, gap } = settings.store;
    const root = document.documentElement;
    root.classList.toggle("vc-float-servers", floatServerList);
    root.classList.toggle("vc-float-sidebar", floatSidebar);
    root.classList.toggle("vc-float-content", floatContent);
    root.style.setProperty("--vc-float-radius", `${roundness}px`);
    root.style.setProperty("--vc-float-gap", `${gap}px`);
}

function clearStyle() {
    const root = document.documentElement;
    root.classList.remove("vc-float-servers", "vc-float-sidebar", "vc-float-content");
    root.style.removeProperty("--vc-float-radius");
    root.style.removeProperty("--vc-float-gap");
}

interface ScrollAnimation {
    target: number;
    current: number;
    last: number;
}

const animations = new Map<HTMLElement, ScrollAnimation>();
let frame = 0;

function animate(now: number) {
    const tau = settings.store.scrollDuration / 3;
    for (const [element, animation] of animations) {
        if (Math.abs(element.scrollTop - animation.current) > 3) {
            animations.delete(element);
            continue;
        }
        const max = element.scrollHeight - element.clientHeight;
        animation.target = Math.min(Math.max(animation.target, 0), max);
        animation.current += (animation.target - animation.current) * (1 - Math.exp(-(now - animation.last) / tau));
        animation.last = now;
        if (Math.abs(animation.target - animation.current) < 0.5) {
            element.scrollTop = animation.target;
            animations.delete(element);
        } else {
            element.scrollTop = animation.current;
            animation.current = element.scrollTop;
        }
    }
    frame = animations.size ? requestAnimationFrame(animate) : 0;
}

function findScroller(start: EventTarget | null, delta: number) {
    for (let element = start instanceof Element ? start : null; element; element = element.parentElement) {
        if (!(element instanceof HTMLElement) || element.scrollHeight <= element.clientHeight + 1) continue;
        const { overflowY } = getComputedStyle(element);
        if (overflowY !== "auto" && overflowY !== "scroll") continue;
        const canMove = delta < 0 ? element.scrollTop > 0 : element.scrollTop < element.scrollHeight - element.clientHeight - 1;
        if (canMove || animations.has(element)) return element;
    }
    return null;
}

function onWheel(event: WheelEvent) {
    if (!settings.store.smoothScrolling || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT : event.deltaY;
    if (Math.abs(delta) < TRACKPAD_DELTA) return;

    const element = findScroller(event.target, delta);
    if (!element) return;
    event.preventDefault();

    const animation = animations.get(element);
    if (animation) animation.target += delta;
    else animations.set(element, { target: element.scrollTop + delta, current: element.scrollTop, last: performance.now() });
    frame ||= requestAnimationFrame(animate);
}

export default definePlugin({
    name: "FloatingUI",
    description: "Floats the server list, sidebar and chat as rounded panels with adjustable roundness, and makes all scrolling smooth.",
    tags: ["Appearance", "Customisation"],
    authors: [OnlycordDevs.Onlycord],
    settings,
    managedStyle,

    start() {
        applyStyle();
        window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    },

    stop() {
        window.removeEventListener("wheel", onWheel, { capture: true });
        cancelAnimationFrame(frame);
        frame = 0;
        animations.clear();
        clearStyle();
    }
});
