import type { HeadBase, LocalFS } from "@hfs";

interface Head extends HeadBase {
    id: string;
    name: string;
    createdAt: Date;
}

// Example object of type LocalFS
export const demoFS: LocalFS<Head, string> = {
    children: {
        folder1: {
            children: {
                "file1.txt": {
                    children: {},
                    data: "This is the content of file1.txt",
                    head: {
                        id: "file1",
                        name: "file1.txt",
                        createdAt: new Date("2024-07-01T10:00:00Z"),
                        path: "/folder1/file1.txt",
                        isDir: false,
                    },
                },
                "file3.txt": {
                    children: {},
                    data: "This is the content of file2.txt",
                    head: {
                        id: "file3",
                        name: "file3.txt",
                        createdAt: new Date("2024-07-01T11:00:00Z"),
                        path: "/folder1/file3.txt",
                        isDir: false,
                    },
                },
            },
            data: "",
            head: {
                id: "folder1",
                name: "Folder 1",
                createdAt: new Date("2024-07-01T09:00:00Z"),
                path: "/folder1",
                isDir: true,
            },
        },
        folder2: {
            children: {
                "file2.txt": {
                    children: {},
                    data: "This is the content of file2.txt",
                    head: {
                        id: "file2",
                        name: "file2.txt",
                        createdAt: new Date("2024-07-02T11:00:00Z"),
                        path: "/folder2/file2.txt",
                        isDir: false,
                    },
                },
            },
            data: "",
            head: {
                id: "folder2",
                name: "Folder 2",
                createdAt: new Date("2024-07-02T10:00:00Z"),
                path: "/folder2",
                isDir: true,
            },
        },
    },
    data: "",
    head: {
        id: "root",
        name: "Root Folder",
        createdAt: new Date("2024-07-01T08:00:00Z"),
        path: "/",
        isDir: true,
    },
};
