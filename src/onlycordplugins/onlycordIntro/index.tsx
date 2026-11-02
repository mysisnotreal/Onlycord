/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { OnlycordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button } from "@webpack/common";

import managedStyle from "./style.css?managed";

const STROKES: { d: string; start: number; length: number; }[] = [
    { d: "M104 44C62 26 22 70 26 124C30 176 74 208 112 182C150 156 158 84 124 54C108 40 86 38 74 52", start: 0, length: 0.62 },
    { d: "M172 130C178 122 186 122 188 134C188 152 182 172 180 190C190 158 208 122 228 124C246 126 238 156 238 174C238 196 256 198 270 182C288 160 306 96 304 58C302 34 286 40 282 76C278 116 272 164 282 184C290 198 306 190 316 172C322 158 328 138 336 124C330 150 326 180 342 186C358 190 372 152 382 124C376 170 366 222 346 244C330 258 322 236 340 216C360 198 392 200 408 186C420 170 438 128 470 124C450 116 420 150 432 180C440 204 470 198 492 172C502 158 518 124 540 122C566 120 574 164 552 188C530 208 504 190 512 156C516 138 530 128 548 134C562 138 576 136 590 128C600 122 606 126 608 136C612 148 620 150 634 142C640 152 636 176 642 188C646 200 662 200 676 184C690 168 704 130 740 124C712 114 682 148 692 180C700 204 730 190 744 150C752 120 760 70 764 38C758 90 748 150 752 180C756 204 780 200 808 170", start: 0.55, length: 2.17 }
];

const DRAW_SECONDS = 2.72;
const HOLD_SECONDS = 0.9;
const FADE_SECONDS = 0.9;

const settings = definePluginSettings({
    lightBackground: {
        type: OptionType.BOOLEAN,
        description: "Use a white background instead of black.",
        default: false
    }
});

let played = false;
let overlay: HTMLDivElement | undefined;

function play() {
    overlay?.remove();
    const element = document.createElement("div");
    overlay = element;
    element.className = "vc-onlycord-intro";
    element.classList.toggle("vc-onlycord-intro-light", settings.store.lightBackground);
    element.setAttribute("aria-hidden", "true");

    const paths = STROKES.map(({ d }) => `<path pathLength="1" d="${d}"/>`).join("");
    element.innerHTML = `
        <svg viewBox="0 0 840 260" role="presentation">
            <defs>
                <linearGradient id="vc-onlycord-intro-ink" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="820" y2="0">
                    <stop offset="0" stop-color="#5dd6ff"/>
                    <stop offset="0.3" stop-color="#6d7dff"/>
                    <stop offset="0.55" stop-color="#c86bff"/>
                    <stop offset="0.8" stop-color="#ff6fa8"/>
                    <stop offset="1" stop-color="#ffb35c"/>
                </linearGradient>
            </defs>
            <g>${paths}</g>
        </svg>`;

    const finish = () => {
        element.remove();
        if (overlay === element) overlay = undefined;
    };
    element.addEventListener("click", finish);
    document.documentElement.appendChild(element);

    element.querySelectorAll("path").forEach((path, index) => {
        const { start, length } = STROKES[index];
        path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
            delay: start * 1000,
            duration: length * 1000,
            easing: "cubic-bezier(0.45, 0.05, 0.4, 0.95)",
            fill: "forwards"
        });
    });
    element.animate([{ opacity: 1 }, { opacity: 0 }], {
        delay: (DRAW_SECONDS + HOLD_SECONDS) * 1000,
        duration: FADE_SECONDS * 1000,
        easing: "ease-in-out",
        fill: "forwards"
    }).finished.then(finish, () => { });
}

function playOnce() {
    if (played) return;
    played = true;
    play();
}

migratePluginSettings("OnlycordIntro", "StarcordIntro");
export default definePlugin({
    name: "OnlycordIntro",
    description: "Writes Onlycord across the whole app after Discord finishes loading, then fades out. Click to skip.",
    tags: ["Appearance", "Customisation"],
    authors: [OnlycordDevs.Onlycord],
    enabledByDefault: true,
    settings,
    managedStyle,
    settingsAboutComponent: () => <Button size={Button.Sizes.SMALL} onClick={play}>Play intro now</Button>,

    flux: {
        CONNECTION_OPEN: playOnce
    },

    stop() {
        overlay?.remove();
        overlay = undefined;
    }
});
