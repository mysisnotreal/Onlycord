/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteCommand } from "../api/types";
import { GearIcon, PaintIcon, RestartIcon } from "../ui/icons";
import { openSettingsPage } from "./openSettings";

const SECTION = "Onlycord";

export const onlycordCommands: PaletteCommand[] = [
    {
        id: "onlycord.settings",
        title: "Open Onlycord Settings",
        section: SECTION,
        keywords: ["onlycord", "vencord", "settings"],
        icon: GearIcon,
        actions: [{
            id: "run",
            label: "Open Onlycord Settings",
            run: () => void openSettingsPage("onlycord_main")
        }]
    },
    {
        id: "onlycord.quickCss",
        title: "Open QuickCSS",
        section: SECTION,
        keywords: ["css", "quickcss", "editor", "style"],
        icon: PaintIcon,
        actions: [{
            id: "run",
            label: "Open QuickCSS",
            run: () => VencordNative.quickCss.openEditor()
        }]
    },
    {
        id: "onlycord.restart",
        title: "Restart Discord",
        section: SECTION,
        keywords: ["restart", "reload", "refresh"],
        icon: RestartIcon,
        actions: [{
            id: "run",
            label: "Restart Discord",
            run: () => window.location.reload()
        }]
    }
];
