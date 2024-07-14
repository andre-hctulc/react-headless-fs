import type { Action } from "./api";

export type HFSSWRKey = {
    path: string | null;
    label: string;
    namespace: string | null;
    stream?: boolean;
    page?: number;
    /** use for key shaping  */
    options?: any;
};

export interface HeadBase {
    path: string;
    isDir: boolean;
}

/**
 * Use module augmentation to add your own status properties.
 */
export interface EntryStatus {
    open: boolean;
    size: number;
    fixed: boolean;
    selected: boolean;
    marked: boolean;
}

export interface HFSStatus {
    entries: Record<string, Partial<EntryStatus>>;
}

export type HFSEvents = {
    createNode: [path: string, oldPath?: string];
    removeNode: [path: string, newPath?: string | null];
    headChange: [path: string];
    statusChange: [status: HFSStatus];
    dataChange: [path: string];
    childrenChange: [path: string | null];
    actionStart: [path: string[] | null, action: Action, actionId: string];
    actionFinish: [path: string[] | null, action: Action, actionId: string, error: Error | null];
};
