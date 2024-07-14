import React from "react";
import type { HeadBase, HFSComponent } from "./types";
import { useHFS } from "./context";
import { HSFDir } from "./dir";
import { HFSTree } from "./core";

export type EntryComponent<H extends HeadBase = HeadBase> = HFSComponent<{
    path: string;
    head: H;
    /** Auto rendered entries. */
    children: React.ReactNode;
}>;

export type EntryComponentProps<H extends HeadBase = HeadBase> = React.ComponentProps<EntryComponent<H>>;

interface HFSEntryProps<H extends HeadBase = HeadBase> {
    tree: HFSTree<H>;
}

export const HFSEntry: React.FC<HFSEntryProps> = ({ tree }) => {
    const { ui, api } = useHFS();
    const File = ui!.entry;

    return (
        <File path={tree.path} head={tree.data!}>
            {tree.data!.isDir ? <HSFDir tree={tree}></HSFDir> : undefined}
        </File>
    );
};
