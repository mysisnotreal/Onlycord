/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { migratePluginSettings, PlainSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { OnlycordIcon } from "@components/Icons";
import { OnlycordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { Tooltip, UserStore } from "@webpack/common";
import onlycordIcon from "file://../../components/settings/tabs/vencord/onlycord.png?base64";

import { getOnlycordUser, hasJoined, isConfigured, joinOnlycord, logger, refreshUsers, startLiveUpdates, stopLiveUpdates, useOnlycordUser } from "./api";
import { BadgeMenuButton } from "./BadgeMenu";
import { arrangeBadges, BadgesById } from "./badges";
import { NameEditorButton } from "./NameEditor";
import { attachNames, startNicknames, stopNicknames } from "./names";
import { settings } from "./settings";

const cl = classNameFactory("vc-onlycord-users-");
const ONLYCORD_ICON = `data:image/png;base64,${onlycordIcon}`;
// a fallback for when live updates aren't available
const REFRESH_INTERVAL = 2 * 60_000;

let refreshInterval: ReturnType<typeof setInterval> | undefined;
let askTimeout: ReturnType<typeof setTimeout> | undefined;

const OnlycordTag = ErrorBoundary.wrap(({ userId }: { userId: string; }) => {
    const user = useOnlycordUser(userId);
    if (!user || !settings.store.showTags) return null;

    return (
        <Tooltip text={`Onlycord User #${user.number}`}>
            {props => (
                <span {...props} className={cl("tag")}>
                    <OnlycordIcon width={14} height={14} />
                    {user.number}
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });

/** The picked badges shown on someone's profile, in Discord's order */
function shownBadges(userId: string) {
    const isSelf = userId === UserStore.getCurrentUser()?.id;
    const ids = arrangeBadges(isSelf ? settings.store.badges ?? [] : getOnlycordUser(userId)?.badges ?? []);
    return ids.flatMap(id => {
        const badge = BadgesById.get(id);
        return badge && (isSelf || !badge.localOnly) ? [badge] : [];
    });
}

const OnlycordBadges: ProfileBadge = {
    id: "onlycord-users",
    position: BadgePosition.END,
    getBadges({ userId }) {
        const user = getOnlycordUser(userId);
        const badges: ProfileBadge[] = shownBadges(userId).map(badge => ({
            id: `onlycord-badge-${badge.id}`,
            description: badge.name,
            name: badge.name,
            detail: badge.detail,
            iconSrc: badge.icon,
        }));

        if (user) {
            badges.unshift({
                id: "onlycord-user",
                description: `Onlycord User #${user.number}`,
                name: "Onlycord User",
                detail: `The #${user.number} person to join Onlycord`,
                iconSrc: ONLYCORD_ICON,
                props: { style: { imageRendering: "pixelated" } },
            });
        }

        return badges;
    }
};

const WrappedBadgeMenuButton = ErrorBoundary.wrap(BadgeMenuButton, { noop: true });
const WrappedNameEditorButton = ErrorBoundary.wrap(NameEditorButton, { noop: true });

migratePluginSettings("OnlycordUsers", "StarcordUsers");
export default definePlugin({
    name: "OnlycordUsers",
    description: "Shows which people use Onlycord with a numbered logo and badge, lets you pick Discord badges for your profile that other Onlycord users can see, and lets you change your name for yourself.",
    tags: ["Appearance", "Friends"],
    authors: [OnlycordDevs.Onlycord],
    dependencies: ["MemberListDecoratorsAPI"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            // Name and badge buttons, left of PlatformSpoofer's button which sits left of the help button
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?=(?:Vencord\.Plugins\.plugins\["PlatformSpoofer"\]\.renderPlatformButton\(\),)?\i\?\(0,\i\.jsx\)\(\i,\{focusSectionProps:"HELP"===)/,
                replace: "$self.renderNameButton(),$self.renderBadgeButton(),"
            }
        },
        {
            // Puts the Onlycord badge first and hides real badges that a picked badge replaces, like a real Nitro Silver when Nitro Opal is picked
            find: "getLegacyUsername(){",
            replacement: {
                match: /(?<=getBadges\(\)\{return)(\[.{0,300}?\])(?=\}getLegacyUsername)/,
                replace: " $self.arrangeProfileBadges(this,$1)"
            }
        },
        {
            // Your local display name and username
            find: "hasBouncedEmail=e.has_bounced_email??",
            replacement: {
                match: /(?<=this\.username=(\i)\.username\?\?"")/,
                replace: ",$self.attachNames(this,$1)"
            }
        },
        {
            // Voice channel users in the channel list
            find: ".VOICE_PANEL}}",
            replacement: {
                match: /children:\[\i\?\?\i\.\i\.getName\((\i)\)/,
                replace: "$&,$self.renderTag($1)"
            }
        }
    ],

    userProfileBadges: [OnlycordBadges],

    renderMemberListDecorator({ user }) {
        return user ? <OnlycordTag userId={user.id} /> : null;
    },

    renderBadgeButton: () => <WrappedBadgeMenuButton key="vc-onlycord-badges" />,
    renderNameButton: () => <WrappedNameEditorButton key="vc-onlycord-name" />,

    attachNames,

    arrangeProfileBadges(profile: { userId?: string; }, badges: { id?: string; }[]) {
        if (!profile?.userId) return badges;

        const replaced = new Set(shownBadges(profile.userId).flatMap(b => b.replaces ?? []));
        const kept = badges.filter(b => !b?.id || !replaced.has(b.id));

        const onlycordBadge = kept.findIndex(b => b?.id === "onlycord-user");
        if (onlycordBadge > 0) kept.unshift(...kept.splice(onlycordBadge, 1));
        return kept;
    },

    flux: {
        CONNECTION_OPEN({ user }: { user: { id: string; }; }) {
            settings.store.userId = user.id;
        }
    },

    renderTag(user?: User) {
        return user ? <OnlycordTag key="vc-onlycord-tag" userId={user.id} /> : null;
    },

    async start() {
        // names used to be set in the LocalUsername plugin
        const oldNames = PlainSettings.plugins.LocalUsername;
        if (oldNames && settings.store.displayName === undefined && settings.store.username === undefined) {
            settings.store.displayName = oldNames.displayName ?? "";
            settings.store.username = oldNames.username ?? "";
        }

        startNicknames();

        if (!isConfigured()) return;

        startLiveUpdates();
        refreshInterval = setInterval(() => refreshUsers().catch(err => logger.error("Failed to load Onlycord users", err)), REFRESH_INTERVAL);

        if (!settings.store.askedToJoin && !await hasJoined()) {
            settings.store.askedToJoin = true;
            askTimeout = setTimeout(() => joinOnlycord(settings.store.badges ?? []), 5000);
        }
    },

    stop() {
        stopNicknames();
        stopLiveUpdates();
        clearInterval(refreshInterval);
        clearTimeout(askTimeout);
        refreshInterval = askTimeout = undefined;
    }
});
