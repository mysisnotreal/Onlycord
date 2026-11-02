/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { OnlycordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, showToast, useEffect, useState } from "@webpack/common";

const FONT_FILE_KEY = "CustomFonts_file";
const IMPORTED_FAMILY = "Onlycord Imported Font";
const SF_PRO_ROUNDED = "SF Pro Rounded";
const FALLBACK = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

let style: HTMLStyleElement | undefined;
let importedFace: FontFace | undefined;

const settings = definePluginSettings({
    font: {
        type: OptionType.SELECT,
        description: "The font used across all of Discord.",
        options: [
            { label: "Discord default", value: "discord", default: true },
            { label: SF_PRO_ROUNDED, value: "sfProRounded" },
            { label: "Installed font", value: "installed" },
            { label: "Imported font file", value: "imported" }
        ],
        onChange: applyFont
    },
    installedFontName: {
        type: OptionType.STRING,
        description: "Name of a font installed on this PC, used with the Installed font option.",
        default: "",
        onChange: applyFont
    },
    keepCodeMonospace: {
        type: OptionType.BOOLEAN,
        description: "Keep code blocks in Discord's monospace font instead of the chosen font.",
        default: false,
        onChange: applyFont
    }
});

function isFontInstalled(family: string) {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return false;
    const sample = "mmmmmmmmlliWWW0123";
    return ["serif", "monospace"].some(base => {
        context.font = `72px ${base}`;
        const baseWidth = context.measureText(sample).width;
        context.font = `72px "${family}", ${base}`;
        return context.measureText(sample).width !== baseWidth;
    });
}

function chosenFamily() {
    const { font, installedFontName } = settings.store;
    if (font === "sfProRounded") return SF_PRO_ROUNDED;
    if (font === "installed") return installedFontName.trim().replace(/"/g, "") || null;
    if (font === "imported") return IMPORTED_FAMILY;
    return null;
}

async function loadImportedFont() {
    const data = await DataStore.get<ArrayBuffer>(FONT_FILE_KEY);
    if (importedFace) document.fonts.delete(importedFace);
    importedFace = undefined;
    if (!data) return;
    importedFace = await new FontFace(IMPORTED_FAMILY, data).load();
    document.fonts.add(importedFace);
}

function applyFont() {
    const family = chosenFamily();
    if (!family) {
        style?.remove();
        style = undefined;
        return;
    }

    const stack = `"${family}", ${FALLBACK}`;
    style ??= document.head.appendChild(document.createElement("style"));
    style.id = "vc-custom-fonts";
    style.textContent = `
        :root, .theme-dark, .theme-light, .theme-darker, .theme-midnight, [class*="theme-"] {
            --font-primary: ${stack};
            --font-display: ${stack};
            --font-headline: ${stack};
            --font-clan-signature: ${stack};
            --font-clan-body: ${stack};
            ${settings.store.keepCodeMonospace ? "" : `--font-code: ${stack};`}
        }
        *${settings.store.keepCodeMonospace ? ":not(code, pre, pre *, code *)" : ""}, *::before, *::after {
            font-family: ${stack} !important;
        }
    `;
}

function FontStatus() {
    const { font } = settings.use(["font"]);
    const [hasFile, setHasFile] = useState(false);

    useEffect(() => {
        DataStore.get(FONT_FILE_KEY).then(data => setHasFile(!!data));
    }, []);

    const importFont = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".ttf,.otf,.woff,.woff2";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                await new FontFace(IMPORTED_FAMILY, await file.arrayBuffer()).load();
                await DataStore.set(FONT_FILE_KEY, await file.arrayBuffer());
                await loadImportedFont();
                settings.store.font = "imported";
                applyFont();
                setHasFile(true);
                showToast({ text: `Now using ${file.name}.`, variant: "success" });
            } catch {
                showToast({ text: "That file could not be read as a font.", variant: "critical" });
            }
        };
        input.click();
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--text-default)" }}>
            {font === "sfProRounded" && !isFontInstalled(SF_PRO_ROUNDED) && (
                <div>SF Pro Rounded is not installed on this PC, so Discord will use its normal font until you install it or import the font file.</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
                <Button size={Button.Sizes.SMALL} onClick={importFont}>Import font file</Button>
                {hasFile && (
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.RED}
                        onClick={async () => {
                            await DataStore.del(FONT_FILE_KEY);
                            await loadImportedFont();
                            if (settings.store.font === "imported") settings.store.font = "discord";
                            applyFont();
                            setHasFile(false);
                        }}
                    >
                        Remove imported font
                    </Button>
                )}
            </div>
        </div>
    );
}

export default definePlugin({
    name: "CustomFonts",
    description: "Applies a font to all of Discord. Choose Discord's default, SF Pro Rounded, any installed font or your own font file.",
    tags: ["Appearance", "Customisation"],
    authors: [OnlycordDevs.Onlycord],
    settings,
    settingsAboutComponent: FontStatus,

    async start() {
        await loadImportedFont();
        applyFont();
    },

    stop() {
        style?.remove();
        style = undefined;
        if (importedFace) document.fonts.delete(importedFace);
        importedFace = undefined;
    }
});
