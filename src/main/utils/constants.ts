/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { copyFileSync, cpSync, existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";

const suffix = IS_DEV ? "dev" : "";

const parentDir = process.env.DISCORD_USER_DATA_DIR ? join(process.env.DISCORD_USER_DATA_DIR, "..") : join(app.getPath("userData"), "..");
const baseDir = join(parentDir, process.env.DISCORD_USER_DATA_DIR ? "OnlycordData" : "Onlycord");

// Copies data from before the rename to Starcord's successor. Old dist folders stay behind, Discord may still be loading from them
function migrateFromStarcord(oldDir: string, newDir: string) {
    if (existsSync(newDir) || !existsSync(oldDir)) return;

    try {
        const tempDir = `${newDir}.migrating`;
        cpSync(oldDir, tempDir, {
            recursive: true,
            filter: src => !(dirname(src) === oldDir && basename(src).startsWith("dist"))
        });

        // Settings hold plugin names, absolute paths into the old folder and format strings like {starcordVersion}
        const settingsFile = join(tempDir, "settings", "settings.json");
        if (existsSync(settingsFile)) {
            const settings = readFileSync(settingsFile, "utf-8");
            writeFileSync(settingsFile, settings.replace(/Starcord/g, "Onlycord").replace(/starcord/g, "onlycord"));
        }

        renameSync(tempDir, newDir);
    } catch (err) {
        console.error("[Onlycord] Failed to copy data from Starcord:", err);
    }
}

if (!process.env.ONLYCORD_USER_DATA_DIR)
    migrateFromStarcord(join(parentDir, process.env.DISCORD_USER_DATA_DIR ? "StarcordData" : "Starcord"), baseDir);

export const DATA_DIR = process.env.ONLYCORD_USER_DATA_DIR ?? join(baseDir, suffix);

export const SETTINGS_DIR = join(DATA_DIR, "settings");
export const THEMES_DIR = join(DATA_DIR, "themes");
export const QUICK_CSS_PATH = join(SETTINGS_DIR, "quickCss.css");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
export const NATIVE_SETTINGS_FILE = join(SETTINGS_DIR, "native-settings.json");
export const DEV_MIGRATED = join(SETTINGS_DIR, "migration");
export const ALLOWED_PROTOCOLS = [
    "https:",
    "http:",
    "steam:",
    "spotify:",
    "com.epicgames.launcher:",
    "tidal:",
    "itunes:",
    "vrcx:",
    "tg:",
];

export const IS_VANILLA = /* @__PURE__ */ process.argv.includes("--vanilla");

if (IS_DEV) {
    const prodDir = join(DATA_DIR, "..");
    const settings = join(prodDir, "settings", "settings.json");
    const quickCss = join(prodDir, "settings", "quickCss.css");

    let migrated = false;
    if (existsSync(DEV_MIGRATED)) {
        const content = readFileSync(DEV_MIGRATED, "utf-8");
        migrated = content.includes("migrated");
    }

    if (!migrated) {
        setTimeout(() => {
            try {
                if (existsSync(settings)) copyFileSync(settings, SETTINGS_FILE);
                if (existsSync(quickCss)) copyFileSync(quickCss, QUICK_CSS_PATH);
                writeFileSync(DEV_MIGRATED, "migrated");
                app.relaunch();
                app.exit(0);
            } catch (err) {
                console.error("[Onlycord] Failed to copy prod data:", err);
            }
        }, 5000);
    }
}
