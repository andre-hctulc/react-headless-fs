import type { HFSTree } from "./core";
import { HFSEventData, HFSEventType } from "./event";
import { HeadBase } from "./types";

export interface ListOptions {
    start?: number;
    limit?: number;
}

export interface DeleteOptions {
    recursive?: boolean;
    force?: boolean;
}

export interface MoveOptions {
    /** @default false */
    overwrite?: boolean;
}

export interface CopyOptions {
    /** @default false */
    overwrite?: boolean;
}

export interface PostOptions {
    /** @default false */
    overwrite?: boolean;
}

export interface PutOptions {}

/**
 * @template H Header type
 * @template D Data type
 */
export interface HFSAdapter<H extends HeadBase = HeadBase, D = any> {
    list: (path: string, options?: ListOptions) => Promise<{ entries: H[]; hasNext: boolean }>;
    head: (path: string) => Promise<H | null>;
    putHead?: (currentHead: H, data: Partial<H>) => Promise<H>;
    get?: (path: string) => Promise<D | undefined>;
    post?: (path: string, head: H, data: D | undefined, options?: PostOptions) => Promise<H>;
    put?: (path: string, data: D, options?: PutOptions) => Promise<void>;
    rm?: (path: string, options?: DeleteOptions) => Promise<void>;
    move?: (from: string, to: string, options?: MoveOptions) => Promise<H>;
    copy?: (from: string, to: string, options?: CopyOptions) => Promise<H>;
    mkdir?: (path: string) => Promise<H>;
    moveMany?: (from: string[], to: string, options?: MoveOptions) => Promise<H[]>;
    copyMany?: (from: string[], to: string, options?: CopyOptions) => Promise<H[]>;
    putHeads?: (newHeads: H[]) => Promise<H[]>;
    extractDir?: (head: H | null) => string;
}

export type ApiEvents<H extends HeadBase = HeadBase, D = any> = {
    entryChange: [head: H | null, oldHead: H | null];
    dataChange: [path: string, data: D | undefined];
    create: [head: H];
    remove: [path: string, header: H];
};

export class HFSApi<H extends HeadBase = HeadBase, D = any> {
    static dirName(path: string): string | null {
        if (!path || path === "/") return null;
        const parts = path.split("/").filter((part) => part);
        parts.pop();
        return "/" + parts.join("/");
    }

    protected _extractDir?: (head: H | null) => string | null;

    extractDir(head: H | null): string | null {
        return this._extractDir?.(head) ?? HFSApi.dirName(head?.path ?? "/");
    }

    constructor(
        private _adapter: HFSAdapter<H, D>,
        private _tree: HFSTree<H>,
        private _dispatch: <T extends HFSEventType>(type: T, data: HFSEventData<T, H, D>) => void
    ) {}

    async list(path: string, options?: ListOptions): Promise<{ entries: H[]; hasNext: boolean }> {
        let node = this._tree.find(path);
        if (!node?.data) {
            const head = await this.head(path);
            if (head) node = this._tree.insert(this.extractDir(head), head);
        }
        try {
            const result = await this._adapter.list(path, options);
            this._tree.insertMany(path, result.entries);
            if (node) {
                this._dispatch("entryChange", [node.data, null]);
            }
            return result;
        } catch (err) {
            node?.updateStatus({ error: err as Error });
            throw err;
        }
    }

    async head(path: string): Promise<H | null> {
        try {
            const head = await this._adapter.head(path);
            if (head) this._tree.insert(this.extractDir(head), head);
            return head;
        } catch (err) {
            const tree = this._tree.find(path);
            tree?.updateStatus({ error: err as Error });
            throw err;
        }
    }

    async putHead(data: Partial<H> & { path: string }): Promise<H> {
        if (!this._adapter.putHead) throw new Error("Not implemented");
        const currentHead = await this.head(data.path);
        if (!currentHead) throw new Error("Not found");
        const newHead = await this._adapter.putHead?.(currentHead, data);
        this._tree.insert(this.extractDir(newHead), newHead);
        this._dispatch("entryChange", [newHead, currentHead]);
        return newHead;
    }

    get(path: string): Promise<D | undefined> {
        if (!this._adapter.get) throw new Error("Not implemented");
        return this._adapter.get(path);
    }

    async post(path: string, head: H, data: D | undefined, options?: PostOptions): Promise<void> {
        if (!this._adapter.post) throw new Error("Not implemented");
        if (!options?.overwrite && (await this.exists(path))) throw new Error("Destination already exists");
        await this._adapter.post(path, head, data, options);
        this._tree.insert(this.extractDir(head), head);
        this._dispatch("dataChange", [path, data]);
        this._dispatch("create", [head]);
    }

    async put(path: string, data: D, options?: PutOptions): Promise<void> {
        if (!this._adapter.put) throw new Error("Not implemented");
        await this._adapter.put(path, data, options);
        this._dispatch("dataChange", [path, data]);
    }

    async rm(path: string, options?: DeleteOptions): Promise<void> {
        if (!this._adapter.rm) throw new Error("Not implemented");
        const currentHead = await this.head(path);
        if (!currentHead) return;
        await this._adapter.rm(path, options);
        this._tree.removeChild(path);
        this._dispatch("remove", [path, currentHead]);
    }

    async move(from: string, to: string, options?: MoveOptions): Promise<H> {
        if (!this._adapter.move) throw new Error("Not implemented");

        const currentHead = await this.head(from);
        if (!currentHead) throw new Error("Not found");
        if (!options?.overwrite && currentHead) throw new Error("Destination already exists");

        const newHead = await this._adapter.move(from, to, options);

        this._tree.remove(from);
        this._tree.insert(this.extractDir(currentHead), newHead);

        this._dispatch("entryChange", [newHead, currentHead]);

        return newHead;
    }

    async copy(from: string, to: string, options?: CopyOptions): Promise<H> {
        if (!this._adapter.copy) throw new Error("Not implemented");

        const currentHead = await this.head(from);
        if (!currentHead) throw new Error("Not found");
        if (!options?.overwrite && currentHead) throw new Error("Destination already exists");

        const newHead = await this._adapter.copy(from, to, options);

        this._tree.insert(this.extractDir(currentHead), newHead);

        this._dispatch("entryChange", [newHead, currentHead]);

        return newHead;
    }

    async mkdir(path: string): Promise<H> {
        if (!this._adapter.mkdir) throw new Error("Not implemented");
        if (await this.exists(path)) throw new Error("Destination already exists");
        const newHead = await this._adapter.mkdir(path);
        this._tree.insert(this.extractDir(newHead), newHead);
        this._dispatch("create", [newHead]);
        return newHead;
    }

    async exists(path: string): Promise<boolean> {
        const head = await this.head(path);
        return !!head;
    }

    async moveMany(from: string[], to: string, options?: MoveOptions): Promise<H[]> {
        if (!from.length) return [];
        if (!this._adapter.moveMany) throw new Error("Not implemented");
        const newHeads = await this._adapter.moveMany(from, to, options);
        this._tree.removeMany(from);
        this._tree.insertMany(this.extractDir(newHeads[0]), newHeads);
        newHeads.forEach((newHead) => this._dispatch("entryChange", [newHead, null]));
        return newHeads;
    }

    async copyMany(from: string[], to: string, options?: CopyOptions): Promise<H[]> {
        if (!from.length) return [];
        if (!this._adapter.copyMany) throw new Error("Not implemented");
        const newHeads = await this._adapter.copyMany(from, to, options);
        this._tree.insertMany(this.extractDir(newHeads[0]), newHeads);
        newHeads.forEach((newHead) => this._dispatch("entryChange", [newHead, null]));
        return newHeads;
    }

    async putHeads(newHeads: H[]): Promise<H[]> {
        if (!this._adapter.putHeads) throw new Error("Not implemented");
        const heads = await this._adapter.putHeads(newHeads);
        heads.forEach((newHead) => this._tree.insert(this.extractDir(newHead), newHead));
        newHeads.forEach((newHead) => this._dispatch("entryChange", [newHead, null]));
        return heads;
    }
}
