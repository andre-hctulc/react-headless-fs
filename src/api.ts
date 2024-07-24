import { genId } from "./system";
import type { HFSEventData, HFSEventType } from "./event";
import type {
    AdapaterPromise,
    CopyOptions,
    DeleteOptions,
    GetOptions,
    HeadBase,
    ListOptions,
    MoveManyOptions,
    MoveOptions,
    PostManyOptions,
    PostOptions,
    PutHeadOptions,
    PutHeadsOptions,
    PutOptions,
} from "./types";

/**
 * The behaviour of the options must be implemented by the adapter itself!
 * @template H Header type
 * @template D Data type
 */
export interface HFSAdapter<H extends HeadBase = HeadBase, D = any> {
    list: (path: string | null, options?: ListOptions) => AdapaterPromise<{ entries: H[]; hasNext: boolean }>;
    head: (path: string) => AdapaterPromise<H | null>;
    /** Can be used to speed up certain operations, like `copyMany` */
    heads?: (paths: string[]) => AdapaterPromise<H[]>;
    /**
     * @return new head
     */
    putHead?: (path: string, data: Partial<H>, options?: PutHeadOptions) => AdapaterPromise<H | void>;
    get?: (path: string, options?: GetOptions) => AdapaterPromise<D | undefined>;
    post?: (path: string, head: Partial<H>, data: D | undefined, options?: PostOptions) => AdapaterPromise<H>;
    postMany?: (
        paths: string[],
        heads: Partial<H>[],
        data: (D | undefined)[],
        options?: PostManyOptions
    ) => AdapaterPromise<void | H[]>;
    put?: (path: string, data: D, options?: PutOptions) => AdapaterPromise<void>;
    /**
     * @return removed?
     */
    remove?: (path: string, options?: DeleteOptions) => AdapaterPromise<boolean | void>;
    removeMany?: (paths: string[], options?: DeleteOptions) => AdapaterPromise<void | boolean[]>;
    move?: (from: string, to: string, options?: MoveOptions) => AdapaterPromise<void>;
    copy?: (from: string, to: string, options?: CopyOptions) => AdapaterPromise<void>;
    mkdir?: (path: string, head?: Partial<H>) => AdapaterPromise<H>;
    moveMany?: (from: string[], to: string[], options?: MoveOptions) => AdapaterPromise<void>;
    copyMany?: (from: string[], to: string[], options?: CopyOptions) => AdapaterPromise<void>;
    putHeads?: (
        paths: string[],
        newHeads: Partial<H>[],
        options?: PutHeadsOptions
    ) => AdapaterPromise<void | H[]>;
    /** Extracts the directory from a given head. Defaults to normal path interpretation */
    extractDir?: (head: H | null) => string | null;
}

export enum Action {
    create = "create",
    remove = "remove",
    removeMany = "removeMany",
    list = "list",
    head = "head",
    heads = "heads",
    putHead = "putHead",
    get = "get",
    post = "post",
    postMany = "postMany",
    put = "put",
    move = "move",
    copy = "copy",
    mkdir = "mkdir",
    moveMany = "moveMany",
    copyMany = "copyMany",
    putHeads = "putHeads",
}

export class HFSApi<H extends HeadBase = HeadBase, D = any> {
    static dirName(path: string): string | null {
        if (!path || path === "/") return null;
        const parts = path.split("/").filter((part) => part);
        parts.pop();
        return "/" + parts.join("/");
    }

    extractDir(head: H | null): string | null {
        return this.adapter.extractDir?.(head) ?? HFSApi.dirName(head?.path ?? "/");
    }

    constructor(
        readonly adapter: HFSAdapter<H, D>,
        private _dispatch: <T extends HFSEventType>(type: T, ...data: HFSEventData<T>) => void
    ) {}

    private async _run<R>(
        path: string | string[] | null,
        action: Action,
        prom: () => Promise<R>
    ): Promise<R> {
        const actionId = genId();
        const paths = () => {
            if (!path) return null;
            if (typeof path === "string") return [path];
            return path;
        };

        this._dispatch("actionStart", paths(), action, actionId);

        try {
            const result = await prom();
            this._dispatch("actionFinish", paths(), action, actionId, null);
            return result;
        } catch (err) {
            if (!(err instanceof Error)) {
                const cause = err;
                err = new Error("Rejected");
                (err as any).cause = cause;
            }
            this._dispatch("actionFinish", paths(), action, actionId, err as Error);
            throw err;
        }
    }

    list(path: string | null, options?: ListOptions): Promise<{ entries: H[]; hasNext: boolean }> {
        return this._run(path, Action.list, async () => this.adapter.list(path, options));
    }

    head(path: string): Promise<H | null> {
        return this._run(path, Action.head, async () => this.adapter.head(path));
    }

    heads(paths: string[]): Promise<H[]> {
        if (!this.adapter.heads) throw new Error("Not implemented");
        return this._run(paths, Action.heads, async () => this.adapter.heads!(paths));
    }

    async exists(path: string): Promise<boolean> {
        const head = await this.head(path);
        return !!head;
    }

    async putHead(path: string, data: Partial<H>, options: PutHeadOptions = {}): Promise<H | void> {
        if (!this.adapter.putHead) throw new Error("Not implemented");
        const newHead = await this._run(path, Action.putHead, async () =>
            this.adapter.putHead!(path, data, options)
        );
        this._dispatch("headChange", path);
        return newHead;
    }

    get(path: string, options?: GetOptions): Promise<D | undefined> {
        if (!this.adapter.get) throw new Error("Not implemented");
        return this._run(path, Action.get, async () => this.adapter.get!(path, options));
    }

    async post(path: string, head: Partial<H>, data: D | undefined, options?: PostOptions): Promise<void> {
        if (!this.adapter.post) throw new Error("Not implemented");

        await this._run(path, Action.post, async () =>
            this.adapter.post!(path, { ...head, path }, data, options)
        );

        this._dispatchCreate([path]);
        this._dispatch("dataChange", path);
    }

    async postMany(
        paths: string[],
        heads: Partial<H>[],
        data: (D | undefined)[],
        options?: PostManyOptions
    ): Promise<void | H[]> {
        if (!this.adapter.postMany) throw new Error("Not implemented");

        if (!paths.length) return;

        const newHeads = await this._run(paths, Action.postMany, async () => {
            if (paths.length !== heads.length || data.length !== heads.length)
                throw new Error("Invalid arguments (length mismatch)");
            await this.adapter.postMany!(paths, heads, data, options);
        });

        this._dispatchCreate(paths);

        return newHeads;
    }

    async put(path: string, data: D, options?: PutOptions): Promise<void> {
        if (!this.adapter.put) throw new Error("Not implemented");
        await this._run(path, Action.put, async () => this.adapter.put!(path, data, options));
        this._dispatch("dataChange", path);
    }

    async remove(path: string, options?: DeleteOptions): Promise<void | boolean> {
        if (!this.adapter.remove) throw new Error("Not implemented");
        const deleted = await this._run(path, Action.remove, async () => this.adapter.remove!(path, options));
        this._dispatchRemove([path]);
        return deleted;
    }

    async removeMany(paths: string[], options?: DeleteOptions): Promise<void | boolean[]> {
        if (!this.adapter.removeMany) throw new Error("Not implemented");
        await this._run(paths, Action.removeMany, async () => this.adapter.removeMany!(paths, options));
        this._dispatchRemove(paths);
    }

    async move(from: string, to: string, options?: MoveOptions): Promise<void> {
        if (from === to) return;

        if (!this.adapter.move) throw new Error("Not implemented");

        await this._run([from, to], Action.move, async () => this.adapter.move!(from, to, options));

        this._dispatchRemove([from], [to]);
        this._dispatchCreate([to], [from]);
    }

    async copy(from: string, to: string, options?: CopyOptions): Promise<void> {
        if (from === to) return;

        if (!this.adapter.copy) throw new Error("Not implemented");

        await this._run([from, to], Action.copy, async () => this.adapter.copy!(from, to, options));

        this._dispatchCreate([to], [from]);
    }

    async mkdir(path: string, head?: Partial<H>): Promise<H> {
        if (!this.adapter.mkdir) throw new Error("Not implemented");
        const newHead = await this._run(path, Action.mkdir, async () => this.adapter.mkdir!(path, head));
        this._dispatchCreate([path]);
        return newHead;
    }

    async moveMany(from: string[], to: string[], options?: MoveManyOptions): Promise<void> {
        if (!this.adapter.moveMany) throw new Error("Not implemented");

        if (!from.length) return;

        await this._run([...from, ...to], Action.moveMany, async () => {
            if (from.length !== to.length) throw new Error("Invalid arguments (length mismatch)");
            await this.adapter.moveMany!(from, to, options);
        });

        this._dispatchRemove(from, to);
        this._dispatchCreate(to, from);
    }

    async copyMany(from: string[], to: string[], options?: CopyOptions): Promise<void> {
        if (!this.adapter.copyMany) throw new Error("Not implemented");

        if (!from.length) return;

        await this._run([...from, ...to], Action.copyMany, async () => {
            if (from.length !== to.length) throw new Error("Invalid arguments (length mismatch)");
            await this.adapter.copyMany!(from, to, options);
        });

        this._dispatchCreate(to, from);
    }

    async putHeads(
        paths: string[],
        newHeads: Partial<H>[],
        options: PutHeadsOptions = {}
    ): Promise<void | H[]> {
        if (!this.adapter.putHeads) throw new Error("Not implemented");

        if (!newHeads.length) return;

        const heads = await this._run(paths, Action.putHeads, async () => {
            if (paths.length !== newHeads.length) throw new Error("Invalid arguments (length mismatch)");
            this.adapter.putHeads?.(paths, newHeads, options);
        });

        paths.forEach((path) => this._dispatch("headChange", path));

        return heads;
    }

    private async _heads(paths: string[]): Promise<H[]> {
        if (this.adapter.heads) {
            return await this.heads(paths);
        } else {
            return await Promise.all(
                paths.map(async (p) => {
                    const head = await this.head(p);
                    if (!head) throw new Error("Head not found");
                    return head;
                })
            );
        }
    }

    private async _dispatchCreate(paths: string[], oldPaths?: string[]) {
        const heads = await this._heads(paths);
        heads.forEach((head, i) => {
            this._dispatch("createNode", head.path, oldPaths?.[i]);
            this._dispatch("headChange", head.path);
            const dir = this.extractDir(head);
            if (dir) this._dispatch("childrenChange", dir);
        });
    }

    private async _dispatchRemove(paths: string[], newPaths?: string[]) {
        const heads = await this._heads(paths);
        heads.forEach((head, i) => {
            this._dispatch("removeNode", head.path, newPaths?.[i]);
            const dir = this.extractDir(head);
            if (dir) this._dispatch("childrenChange", dir);
        });
    }
}
