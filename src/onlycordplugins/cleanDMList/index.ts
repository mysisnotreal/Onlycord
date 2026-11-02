/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OnlycordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import managedStyle from "./style.css?managed";

const settings = definePluginSettings({
    hideShopLinks: {
        type: OptionType.BOOLEAN,
        description: "Hide Nitro, Shop and Quests from the top of the list.",
        default: true,
        onChange: applyClasses
    },
    hideActivity: {
        type: OptionType.BOOLEAN,
        description: "Hide the status and activity line under each name.",
        default: false,
        onChange: applyClasses
    }
});

function applyClasses() {
    const root = document.documentElement;
    root.classList.add("vc-clean-dm");
    root.classList.toggle("vc-clean-dm-no-shop", settings.store.hideShopLinks);
    root.classList.toggle("vc-clean-dm-no-activity", settings.store.hideActivity);
}

export default definePlugin({
    name: "CleanDMList",
    description: "Gives the direct message list a cleaner look with soft rounded rows and less clutter.",
    tags: ["Appearance", "Customisation", "Friends"],
    authors: [OnlycordDevs.Onlycord],
    settings,
    managedStyle,

    start: applyClasses,

    stop() {
        document.documentElement.classList.remove("vc-clean-dm", "vc-clean-dm-no-shop", "vc-clean-dm-no-activity");
    }
});
