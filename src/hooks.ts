import { useHFS } from "./context";
import React from "react";
import useSWR, { SWRConfiguration, useSWRConfig } from "swr";
import useSWRInfinite, { SWRInfiniteConfiguration } from "swr/infinite";
import type { EntryStatus, HeadBase, HFSSWRKey } from "./types";
import type { GetOptions, ListOptions } from "./api";
import type { HFSEvent, HFSEventListener, HFSEventType } from "./event";

enum CACHE_LABEL {
    HEAD = "$$head",
    ENTRIES = "$$entries",
    DATA = "$$data",
}

export type UseHeadOptions<H extends HeadBase = HeadBase> = { swr?: SWRConfiguration<H | null, Error> };

export function useHead<H extends HeadBase>(path: string | false, options: UseHeadOptions<H> = {}) {
    const { api, namespace } = useHFS<H>();
    const key: HFSSWRKey | null = path ? { namespace, path, label: CACHE_LABEL.HEAD, stream: false } : null;
    const query = useSWR<H | null, Error, HFSSWRKey | null>(
        key,
        ({ path }) => {
            return api.head(path!);
        },
        options.swr
    );
    return query;
}

export type UseEntriesOptions<H extends HeadBase = HeadBase> = ListOptions & {
    swr?: SWRConfiguration<{ entries: H[]; hasNext: boolean }, Error>;
};

/**
 *
 * @param path _false_: disabled, _null_: roots, _string_: dir
 * @param options
 */
export function useEntries<H extends HeadBase>(
    path: string | null | false,
    options: UseEntriesOptions<H> = {}
) {
    const { api, namespace } = useHFS<H>();
    const key: HFSSWRKey | null = path
        ? {
              namespace,
              path,
              label: CACHE_LABEL.ENTRIES,
              stream: false,
              options: [options.limit, options.start],
          }
        : null;
    const query = useSWR<{ entries: H[]; hasNext: boolean }, Error, HFSSWRKey | null>(
        key,
        ({ path }) => {
            return api.list(path, options);
        },
        options.swr
    );
    const isEmpty = query.data && query.data.entries.length === 0;
    const entries = React.useMemo(() => query.data?.entries || [], [query.data]);
    return { ...query, entries, isEmpty };
}

export type UseEntriesStreamerOptions<H extends HeadBase = HeadBase> = {
    swr?: SWRInfiniteConfiguration<{ entries: H[]; hasNext: boolean }, Error>;
};

/**
 *
 * @param path _false_: disabled, _null_: roots, _string_: dir
 * @param options
 */
export function useEntriesStreamer<H extends HeadBase>(
    path: string | null | false,
    options: UseEntriesStreamerOptions<H> = {}
) {
    const { api, namespace, config } = useHFS<H>();
    const infinite = useSWRInfinite<
        { entries: H[]; hasNext: boolean },
        Error,
        (page: number, pre: { hasNext: boolean }) => HFSSWRKey | null
    >(
        (page, pre) => {
            if (path === false || !pre.hasNext) return null;
            return { page: page, namespace, path, label: CACHE_LABEL.ENTRIES, stream: true };
        },
        ({ path, page }) => {
            return api.list(path, { limit: config.pageSize, start: (page || 0) * config.pageSize });
        },
        options.swr
    );
    return infinite;
}

export type UseDataOptions<D = any> = GetOptions & { swr?: SWRConfiguration<D, Error> };

export function useData<D = any>(path: string | false, options: UseDataOptions = {}) {
    const { api, namespace } = useHFS();
    const key: HFSSWRKey | null = path ? { namespace, path, label: CACHE_LABEL.DATA, stream: false } : null;
    const query = useSWR<D, Error, HFSSWRKey | null>(
        key,
        ({ path }) => {
            return api.get(path!, options);
        },
        options.swr
    );
    return query;
}

const keyMatches = (
    key: any,
    label: string | string[],
    path: string | string[] | null,
    namespace: string | null
) => {
    const p = new Set(Array.isArray(path) ? path : [path]);
    const l = new Set(Array.isArray(label) ? label : [label]);
    if (!key || typeof key !== "object") return false;
    return key.namespace === namespace && l.has((key as HFSSWRKey).label) && p.has((key as HFSSWRKey).path);
};

export function useSetEntryStatus() {
    const { updateStatus } = useHFS();

    const setEntryStatus = React.useCallback(
        (
            path: string,
            newStatus: Partial<EntryStatus> | ((prev: Partial<EntryStatus>) => Partial<EntryStatus>)
        ) => {
            updateStatus((prev) => {
                if (typeof newStatus === "function") newStatus = newStatus(prev.entries[path] || {});
                prev.entries[path] = { ...prev.entries[path], ...newStatus };
            });
        },
        [updateStatus]
    );

    return setEntryStatus;
}

export function useEntryStatus(path: string) {
    const { status } = useHFS();
    const entryStatus = React.useMemo(() => status.entries[path] || {}, [status.entries, path]);
    const globalSetEntryStatus = useSetEntryStatus();
    const setEntryStatus = React.useCallback(
        (newStatus: Partial<EntryStatus> | ((prev: Partial<EntryStatus>) => Partial<EntryStatus>)) => {
            globalSetEntryStatus(path, newStatus);
        },
        [path, globalSetEntryStatus]
    );
    return [entryStatus, setEntryStatus];
}

export function useRevalidator() {
    const { namespace } = useHFS();
    const { mutate } = useSWRConfig();

    const revalidateDir = React.useCallback(
        async (path: string | null) => {
            await mutate((key) => keyMatches(key, CACHE_LABEL.ENTRIES, path, namespace));
        },
        [mutate, namespace]
    );

    const revalidateHead = React.useCallback(
        async (path: string) => {
            await mutate((key) => keyMatches(key, CACHE_LABEL.HEAD, path, namespace));
        },
        [mutate, namespace]
    );

    const revalidateData = React.useCallback(
        async (path: string) => {
            await mutate((key) => keyMatches(key, CACHE_LABEL.DATA, path, namespace));
        },
        [mutate, namespace]
    );

    return { revalidateDir, revalidateHead, revalidateData, mutate };
}

useRevalidator.keyMatches = keyMatches;

export function useListener<T extends HFSEventType>(type: T, listener: (event: HFSEvent<T>) => void) {
    const { on, off } = useHFS();
    React.useEffect(() => {
        let l: HFSEventListener<T>;
        on(type as T, (l = (e) => listener(e)));
        return () => {
            off(type as T, l);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, on, off]);
}
