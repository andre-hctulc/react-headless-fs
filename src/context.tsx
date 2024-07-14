"use client";

import React from "react";
import type { HFSConfig } from "./fs";
import type { HFSApi } from "./api";
import type { HFSEvent, HFSEventData, HFSEventType } from "./event";
import type { HFSStatus, HeadBase } from "./types";

interface HFSContext<H extends HeadBase = HeadBase, D = any> {
    api: HFSApi<H, D>;
    root: string;
    on: <T extends HFSEventType>(type: T, listener: (event: HFSEvent<T>) => void) => void;
    off: <T extends HFSEventType>(type: T, listener: (event: HFSEvent<T>) => void) => void;
    dispatch: <T extends HFSEventType>(type: T, ...data: HFSEventData<T>) => void;
    config: HFSConfig;
    namespace: string | null;
    status: HFSStatus;
    updateStatus: (status: HFSStatus | ((status: HFSStatus) => HFSStatus | void)) => void;
}

export const HFSContext = React.createContext<HFSContext | null>(null);

export function useHFS<H extends HeadBase = HeadBase, D = any>(): HFSContext<H, D> {
    const context = React.useContext(HFSContext);
    if (!context) {
        throw new Error("`useHSFContext` must be used within a `HSFProvider`");
    }
    return context as any;
}
