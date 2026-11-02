/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelToolbarButton } from "@api/HeaderBar";
import { OnlycordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createRoot, FluxDispatcher, MediaEngineStore, SelectedChannelStore, UserStore, useStateFromStores } from "@webpack/common";

import { listenerRelativePosition, Room, usersInCall } from "./Room";
import { settings } from "./settings";
import managedStyle from "./style.css?managed";

const DEFAULT_POSITION = { x: 0, y: 0, z: -1 };
const SPATIAL_OVERRIDES = { isSpatial: true, distanceAttenuation: { enabled: true, minDistance: 2 }, airAbsorption: { enabled: true } };

let timer: ReturnType<typeof setInterval> | undefined;
let room: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;
let audioOn = false;

function setOverrides(overrides: object) {
    FluxDispatcher.dispatch({ type: "AUDIO_SET_SPATIAL_AUDIO_OVERRIDES", overrides });
}

function positionUsers(position: (index: number, count: number) => typeof DEFAULT_POSITION) {
    const users = usersInCall();
    const self = UserStore.getCurrentUser().id;
    MediaEngineStore.getMediaEngine().eachConnection(connection => {
        if (!("setUserPosition" in connection) || typeof connection.setUserPosition !== "function") return;
        for (const [index, userId] of users.entries()) {
            if (userId !== self) connection.setUserPosition(userId, position(index, users.length));
        }
    }, "default");
}

function stopAudio() {
    if (!audioOn) return;
    audioOn = false;
    positionUsers(() => DEFAULT_POSITION);
    setOverrides({});
}

function syncAudio() {
    if (!settings.store.spatialAudio) return stopAudio();
    if (!audioOn) {
        audioOn = true;
        setOverrides(SPATIAL_OVERRIDES);
    }
    positionUsers(listenerRelativePosition);
}

function unmountRoom() {
    root?.unmount();
    room?.remove();
    root = room = undefined;
}

function syncView() {
    const host = document.querySelector('[class*="callContainer"] [class*="root_"]');
    if (!settings.store.showRoom || !SelectedChannelStore.getVoiceChannelId() || !host) return unmountRoom();
    if (room?.parentElement === host) return;

    unmountRoom();
    room = document.createElement("div");
    room.className = "vc-spatial-room-root";
    host.prepend(room);
    root = createRoot(room);
    root.render(<Room />);
}

function sync() {
    syncAudio();
    syncView();
}

function RoomIcon(props: { className?: string; }) {
    return (
        <svg {...props} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2 2 7.5v9L12 22l10-5.5v-9L12 2Zm0 2.3 6.9 3.8L12 11.9 5.1 8.1 12 4.3ZM4 9.8l7 3.9v5.6l-7-3.9V9.8Zm9 9.5v-5.6l7-3.9v5.6l-7 3.9Z" />
        </svg>
    );
}

function RoomToggle() {
    const { showRoom } = settings.use(["showRoom"]);
    const inCall = useStateFromStores([SelectedChannelStore], () => !!SelectedChannelStore.getVoiceChannelId());
    if (!inCall) return null;

    return (
        <ChannelToolbarButton
            icon={RoomIcon}
            tooltip={showRoom ? "Switch to the normal call view" : "Switch to the 3D room"}
            selected={showRoom}
            onClick={() => {
                settings.store.showRoom = !showRoom;
                syncView();
            }}
        />
    );
}

export default definePlugin({
    name: "SpatialVoiceRoom",
    description: "Turns voice calls into a 3D room with water, grass, sky and more, with screenshares above profile pictures and each voice coming from where that person sits.",
    tags: ["Voice", "Appearance"],
    authors: [OnlycordDevs.Onlycord],
    settings,
    managedStyle,

    headerBarButton: {
        icon: RoomIcon,
        location: "channeltoolbar",
        render: () => <RoomToggle />
    },

    flux: {
        VOICE_STATE_UPDATES: sync
    },

    start() {
        sync();
        timer = setInterval(sync, 1000);
    },

    stop() {
        clearInterval(timer);
        unmountRoom();
        stopAudio();
    }
});
