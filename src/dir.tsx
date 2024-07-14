import React from "react";
import type { EntryStatus, HeadBase, HFSComponent } from "./types";
import { useHFS } from "./context";
import { HFSEntry } from "./entry";
import { HFSTree } from "./core";

export type DirComponent<H extends HeadBase = HeadBase> = HFSComponent<{
    path: string;
    head: H | null;
    /** Auto rendered entries. */
    children: React.ReactNode;
    /** Rendered entries */
    entries: H[];
    status: EntryStatus;
}>;

export type DirComponentProps<H extends HeadBase = HeadBase> = React.ComponentProps<DirComponent<H>>;

interface HFSDirProps<H extends HeadBase = HeadBase> {
    tree: HFSTree<H>;
}

export const HSFDir: React.FC<HFSDirProps> = ({ tree }) => {
    const { api, config, ui } = useHFS();
    const entries = React.useMemo(() => tree.children(), [tree]);
    const heads = React.useMemo(() => tree.children().map((c) => c.data!), [tree]);

    const Dir = ui!.dir;

    return (
        <Dir path={tree.path} entries={heads} head={tree.data} status={tree.status}>
            {tree.status.open && entries?.map((child) => <HFSEntry tree={child} key={child.path} />)}
        </Dir>
    );
};
