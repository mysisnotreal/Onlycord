/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    environment: {
        type: OptionType.SELECT,
        description: "Where the room takes place.",
        options: [
            { label: "Midnight", value: "midnight" },
            { label: "Moonlit lake", value: "water", default: true },
            { label: "Meadow", value: "meadow" },
            { label: "Desert sunset", value: "sunset" },
            { label: "Deep space", value: "space" },
            { label: "Neon grid", value: "neon" },
            { label: "Aurora snowfield", value: "aurora" }
        ]
    },
    quality: {
        type: OptionType.SELECT,
        description: "Environment render quality. Lower it if calls feel slow.",
        options: [
            { label: "Low", value: 0.5 },
            { label: "Medium", value: 0.75, default: true },
            { label: "High", value: 1 }
        ]
    },
    showRoom: {
        type: OptionType.BOOLEAN,
        description: "Show the 3D room in calls. You can also toggle this from the call toolbar.",
        default: true
    },
    showStreams: {
        type: OptionType.BOOLEAN,
        description: "Show screenshares and cameras above each person's profile picture.",
        default: true
    },
    spatialAudio: {
        type: OptionType.BOOLEAN,
        description: "Play each person's voice from where they sit in the room.",
        default: true
    }
});
