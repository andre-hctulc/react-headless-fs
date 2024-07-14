import { useHFS } from "./context";
import React from "react";
import { EntryStatus, HeadBase } from "./types";
import { HFSTree } from "./core";
import { HFSEventListener } from "./event";

export function useEntryStatus(path: string): EntryStatus & { notFound?: boolean } {
    const { tree } = useHFS();
    const status = React.useMemo(() => {
        const status = tree.find(path)?.status;
        return status || { loading: false, open: false, error: null, notFound: true };
    }, [path, tree]);
    return status;
}

export function useHead<H extends HeadBase>(path: string): H | null {
    const { tree } = useHFS<H>();
    const evo = useEvo(path);
    const data = React.useMemo(() => {
        const data = tree.find(path)?.data;
        return data || null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evo, path, tree]);
    return data;
}

export function useTree<H extends HeadBase>(path: string): HFSTree<H> | null {
    const { tree } = useHFS<H>();
    const evo = useEvo(path);
    const node = React.useMemo(() => {
        return tree.find(path);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evo, path, tree]);
    return node;
}

export function useChildren<H extends HeadBase>(path: string): HFSTree<H>[] {
    const { tree } = useHFS<H>();
    const children = React.useMemo(() => {
        return tree.find(path)?.children() || [];
    }, [path, tree]);
    return children;
}

export function useEvo(path: string) {
    const { on, off, api } = useHFS();
    const [evo, setEvo] = React.useState(0);
    const reload = () => {
        setEvo((e) => {
            if (e > 10000) return 0;
            else return e + 1;
        });
    };
    React.useEffect(() => {
        let createListener: HFSEventListener<"create">,
            removeListener: HFSEventListener<"remove">,
            entryChangeListener: HFSEventListener<"entryChange">;

        on(
            "create",
            (createListener = (ev) => {
                // rerender when the new child is created
                if (api.extractDir(ev.data[0] ?? null) === path) reload();
            })
        );
        on(
            "remove",
            (removeListener = (ev) => {
                // rerender when the self or child is removed
                if (api.extractDir(ev.data[1]) === path || ev.data[0] === path) reload();
            })
        );
        on(
            "entryChange",
            (entryChangeListener = (ev) => {
                // rerender when the self or child is altered
                if (api.extractDir(ev.data[0] ?? null) === path || path === ev.data[0]?.path) reload();
            })
        );
        return () => {
            off("create", createListener);
            off("remove", removeListener);
            off("entryChange", entryChangeListener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    return evo;
}
