import React from "react";
import type { HFSConfig, HFSUI } from "./fs";
import type { HFSApi } from "./adapter";
import { HFSEvent, HFSEventData, HFSEventType } from "./event";
import { HFSTree } from "./core";
import { HeadBase } from "./types";

interface HFSContext<H extends HeadBase = HeadBase, D = any> {
    api: HFSApi<H, D>;
    root: string;
    on: <T extends HFSEventType>(type: T, listener: (event: HFSEvent<T, H, D>) => void) => void;
    off: <T extends HFSEventType>(type: T, listener: (event: HFSEvent<T, H, D>) => void) => void;
    dispatch: <T extends HFSEventType>(type: T, data: HFSEventData<T, H, D>) => void;
    config: HFSConfig;
    ui: HFSUI<H, D> | null;
    namespace: string | null;
    tree: HFSTree<H>;
}

export const HFSContext = React.createContext<HFSContext | null>(null);

export function useHFS<H extends HeadBase = HeadBase, D = any>(): HFSContext<H, D> {
    const context = React.useContext(HFSContext);
    if (!context) {
        throw new Error("`useHSFContext` must be used within a `HSFProvider`");
    }
    return context as any;
}
