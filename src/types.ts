import React from "react";

interface HFSComponentBaseProps<H extends HeadBase = HeadBase, D = any> {}

export type HFSComponent<P extends object> = React.ComponentType<P & HFSComponentBaseProps>;

export type HFSSWRKey = { path: string; label: string; page?: number };

export interface HeadBase {
    path: string;
    isDir: boolean;
}

/**
 * Use module augmentation to add your own status properties.
 */
export interface EntryStatus {
    open: boolean;
    loading: boolean;
    error: Error | null;
}
