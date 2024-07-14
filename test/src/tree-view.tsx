import { useEntries } from "@hfs";
import React from "react";

interface TreeViewProps {
    path: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ path }) => {
    const { entries } = useEntries(path);

    return (
        <ul>
            {entries.map((node) => (
                <li key={node.path}>
                    <span>{node.path}</span>
                    {node.isDir && <TreeView path={node.path} />}
                </li>
            ))}
        </ul>
    );
};
