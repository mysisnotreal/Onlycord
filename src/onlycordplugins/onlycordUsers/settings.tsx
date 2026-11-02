/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { OptionType } from "@utils/types";
import { showToast, UserStore, useState } from "@webpack/common";

import { isConfigured, joinOnlycord, leaveOnlycord, logger, useOnlycordUser } from "./api";

function MembershipSettings() {
    const user = useOnlycordUser(UserStore.getCurrentUser()?.id ?? "");
    const [busy, setBusy] = useState(false);

    if (!isConfigured()) {
        return <Notice.Info>The Onlycord user list isn't set up yet, so your badges only show on your own client.</Notice.Info>;
    }

    async function leave() {
        setBusy(true);
        try {
            await leaveOnlycord();
            showToast({ text: "You left the Onlycord user list", variant: "success" });
        } catch (err) {
            logger.error("Failed to leave the Onlycord user list", err);
            showToast({ text: err instanceof Error ? err.message : "Couldn't leave the Onlycord user list", variant: "critical" });
        }
        setBusy(false);
    }

    return (
        <Flex flexDirection="column" gap="8px">
            <Paragraph>
                {user
                    ? `You're Onlycord user #${user.number}. Other Onlycord users can see your number and badges.`
                    : "Join the Onlycord user list to get your number and show your badges to other Onlycord users. Discord asks you to confirm it's your account."}
            </Paragraph>
            <Flex gap="8px">
                {user
                    ? <Button variant="dangerSecondary" disabled={busy} onClick={leave}>Leave the Onlycord user list</Button>
                    : <Button onClick={() => joinOnlycord(settings.store.badges ?? [])}>Join the Onlycord user list</Button>}
            </Flex>
        </Flex>
    );
}

export const settings = definePluginSettings({
    membership: {
        type: OptionType.COMPONENT,
        component: MembershipSettings
    },
    showTags: {
        type: OptionType.BOOLEAN,
        description: "Show the logo with their number next to Onlycord users in the member list, direct messages and voice channels.",
        default: true
    }
}).withPrivateSettings<{
    badges?: string[];
    askedToJoin?: boolean;
    displayName?: string;
    username?: string;
    userId?: string;
}>();
