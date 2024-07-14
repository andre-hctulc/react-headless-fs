import React from "react";
import { HFSContext, useHFS } from "./context";
import { HFSEvent, HFSEventData, HFSEventListener, HFSEventType } from "./event";
import { HFSAdapter, HFSApi } from "./adapter";
import type { HeadBase, HFSComponent } from "./types";
import { HSFDir, DirComponent } from "./dir";
import type { EntryComponent } from "./entry";
import { HFSTree } from "./core";
import { useEvo, useHead } from "./hooks";
import { capitalize } from "./system";

type RootComponent<H extends HeadBase = HeadBase> = HFSComponent<{
    head: H | null;
    root: string;
    children: React.ReactNode;
}>;

export type RootComponentProps<H extends HeadBase = HeadBase> = React.ComponentProps<RootComponent<H>>;

export interface HFSUI<H extends HeadBase = HeadBase, D = any> {
    dir: DirComponent<H>;
    entry: EntryComponent<H>;
    root: RootComponent<H>;
}

type HFSEventProps<H extends HeadBase = HeadBase, D = any> = {
    [T in HFSEventType as `on${Capitalize<T>}`]?: (...args: HFSEventData<T, H, D>) => void;
};

interface HFSProps<H extends HeadBase = HeadBase, D = any> extends HFSEventProps<H, D> {
    /** @default "/" */
    root?: string;
    adapter: HFSAdapter<H, D>;
    ui?: HFSUI<H, D>;
    /** This config is merged with the default config */
    config?: Partial<HFSConfig>;
    slots?: { after?: React.ReactNode; before?: React.ReactNode };
    namespace?: string;
    children?: React.ReactNode;
}

export interface HFSConfig {
    /** @default 20 */
    pageSize: number;
}

const defaultConfig: HFSConfig = {
    pageSize: 20,
};

export function HFS<H extends HeadBase = HeadBase, D = any>({
    adapter,
    root,
    config,
    ui,
    namespace,
    children,
    slots,
    ...props
}: HFSProps<H, D>) {
    const listeners = React.useRef<Map<string, Set<HFSEventListener>>>(new Map());
    const conf = React.useMemo(() => ({ ...defaultConfig, ...config }), [config]);
    const dispatch = React.useCallback(
        <T extends HFSEventType>(type: T, data: HFSEventData<any, any, any>) => {
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
    const on = React.useCallback((type: string, listener: HFSEventListener<any, any, any>) => {
        const set = listeners.current.get(type) || new Set();
        set.add(listener);
        listeners.current.set(type, set);
    }, []);
    const off = React.useCallback((type: string, listener: HFSEventListener<any, any, any>) => {
        const set = listeners.current.get(type);
        if (set) set.delete(listener);
    }, []);
    const r = root ?? "/";
    const ns = namespace || null;
    const tree = React.useMemo(() => new HFSTree<H>(r, null, [], true, { open: true }), [r]);
    const api = React.useMemo<HFSApi<H, D>>(() => {
        return new HFSApi<H, D>(adapter, tree, dispatch);
    }, [adapter, tree, dispatch]);

    React.useEffect(() => {
        const l = listeners.current;
        return () => {
            l.clear();
        };
    }, []);

    return (
        <HFSContext.Provider
            value={{
                root: r,
                api: api as HFSApi<any, any>,
                on,
                off,
                dispatch,
                config: conf,
                ui: (ui as HFSUI<any, any> | undefined) || null,
                namespace: ns,
                tree,
            }}
        >
            <FSRoot root={r} slots={slots}>
                {children}
            </FSRoot>
        </HFSContext.Provider>
    );
}

interface FSRootProps {
    root: string;
    slots?: { before?: React.ReactNode; after?: React.ReactNode };
    children: React.ReactNode;
}

const FSRoot: React.FC<FSRootProps> = ({ root, slots, children }) => {
    const { ui, tree } = useHFS();
    const evo = useEvo(root);
    const head = useHead(root);
    const Root = ui?.root;

    return (
        <>
            ++{evo}++
            {slots?.before}
            {children}
            {Root && (
                <Root head={head} root={root}>
                    {head && <HSFDir tree={tree} />}
                </Root>
            )}
        </>
    );
};
