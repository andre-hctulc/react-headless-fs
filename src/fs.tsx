"use client";

import React from "react";
import { HFSContext } from "./context";
import { HFSEvent, HFSEventData, HFSEventListener, HFSEventType } from "./event";
import { HFSAdapter, HFSApi } from "./api";
import type { HFSStatus, HeadBase } from "./types";
import { SWRConfig, SWRConfiguration } from "swr";
import { capitalize, deepCopy } from "./system";
import { useLocalStorage } from "usehooks-ts";
import { useListener, useRevalidator } from "./hooks";

type HFSEventProps<H extends HeadBase = HeadBase, D = any> = {
    [T in HFSEventType as `on${Capitalize<T>}`]?: (...args: HFSEventData<T>) => void;
};

interface HFSProps<H extends HeadBase = HeadBase, D = any> extends HFSEventProps<H, D> {
    /** @default "/" */
    root?: string;
    adapter: HFSAdapter<H, D>;
    /** This config is merged with the default config */
    config?: Partial<HFSConfig>;
    namespace?: string;
    children?: React.ReactNode;
    swrConfig?: SWRConfiguration;
}

export interface HFSConfig {
    /** @default 20 */
    pageSize: number;
    initialStatus: HFSStatus;
    /** @default true */
    autoRevalidate: boolean;
}

const defaultConfig: HFSConfig = {
    pageSize: 20,
    initialStatus: { entries: {} },
    autoRevalidate: true,
};

export function HFS<H extends HeadBase = HeadBase, D = any>({
    adapter,
    root,
    config,
    namespace,
    children,
    swrConfig,
    ...props
}: HFSProps<H, D>) {
    const listeners = React.useRef<Map<string, Set<HFSEventListener<any>>>>(new Map());
    const conf = React.useMemo(() => ({ ...defaultConfig, ...config }), [config]);
    const dispatch = React.useCallback(
        <T extends HFSEventType>(type: T, ...data: HFSEventData<T>) => {
            const set = listeners.current.get(type);
            if (set) {
                for (const listener of set) {
                    listener(new HFSEvent(type, data));
                    const eventProp = (props as any)[`on${capitalize(type)}`];
                    if (typeof eventProp === "function") eventProp(data);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    const on = React.useCallback(<T extends HFSEventType>(type: T, listener: HFSEventListener<T>) => {
        const set = listeners.current.get(type) || new Set();
        set.add(listener);
        listeners.current.set(type, set);
    }, []);
    const off = React.useCallback(<T extends HFSEventType>(type: T, listener: HFSEventListener<T>) => {
        const set = listeners.current.get(type);
        if (set) set.delete(listener);
    }, []);
    const r = root ?? "/";
    const ns = namespace || null;
    const api = React.useMemo<HFSApi<H, D>>(() => {
        return new HFSApi<H, D>(adapter, dispatch);
    }, [adapter, dispatch]);
    const [status, setStatus] = useLocalStorage<HFSStatus>(
        `$$hfs:${ns}:status`,
        conf.initialStatus ?? { entries: {} }
    );
    const updateStatus = React.useCallback(
        (status: HFSStatus | ((status: HFSStatus) => HFSStatus | void)) => {
            setStatus((prev) => {
                let newS: HFSStatus;
                if (typeof status === "function") {
                    prev = deepCopy(prev);
                    const newStatus = status(prev);
                    newS = newStatus ?? prev;
                } else {
                    newS = status;
                }
                dispatch("statusChange", newS);
                return newS;
            });
        },
        [setStatus, dispatch]
    );

    React.useEffect(() => {
        const l = listeners.current;
        return () => {
            l.clear();
        };
    }, []);

    return (
        <SWRConfig value={swrConfig}>
            <HFSContext.Provider
                value={{
                    root: r,
                    api: api as HFSApi<any, any>,
                    on,
                    off,
                    dispatch,
                    config: conf,
                    namespace: ns,
                    status,
                    updateStatus,
                }}
            >
                {conf.autoRevalidate && <AutoRevalidate />}
                {children}
            </HFSContext.Provider>
        </SWRConfig>
    );
}

function AutoRevalidate() {
    const { revalidateDir, revalidateData, revalidateHead } = useRevalidator();
    useListener("dataChange", (e) => {
        revalidateData(e.data[0]);
    });
    useListener("childrenChange", (e) => {
        revalidateDir(e.data[0]);
    });
    useListener("headChange", (e) => {
        revalidateHead(e.data[0]);
    });
    return <></>;
}
