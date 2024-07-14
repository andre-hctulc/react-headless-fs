import { useHFS, useTree } from "@hfs";
import React from "react";

interface TreeViewProps {
    path: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ path }) => {
    const { api, tree } = useHFS();
    const dirTree = useTree(path);

    React.useEffect(() => {
        api.list(path);
    }, []);

    return (
        <ul>
            {dirTree + ""}
            {dirTree?.children().map((node) => (
                <li key={node.path}>
                    <span>{node.path}</span>
                    {node.data?.isDir && <TreeView path={node.path} />}
                </li>
            ))}
        </ul>
    );
};
