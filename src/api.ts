import { genId } from "./system";
import type { HFSEventData, HFSEventType } from "./event";
import type { HeadBase } from "./types";

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

export interface GetOptions {}

/**
 * @template H Header type
 * @template D Data type
 */
export interface HFSAdapter<H extends HeadBase = HeadBase, D = any> {
    list: (path: string | null, options?: ListOptions) => Promise<{ entries: H[]; hasNext: boolean }>;
    head: (path: string) => Promise<H | null>;
    /** Can be used to speed up certain operations, like `copyMany` */
    heads?: (paths: string[]) => Promise<H[]>;
    putHead?: (data: H) => Promise<void>;
    get?: (path: string, options?: GetOptions) => Promise<D | undefined>;
    post?: (path: string, head: H, data: D | undefined, options?: PostOptions) => Promise<H>;
    put?: (path: string, data: D, options?: PutOptions) => Promise<void>;
    remove?: (path: string, options?: DeleteOptions) => Promise<void>;
    removeMany?: (paths: string[], options?: DeleteOptions) => Promise<void>;
    move?: (from: string, to: string, options?: MoveOptions) => Promise<void>;
    copy?: (from: string, to: string, options?: CopyOptions) => Promise<void>;
    mkdir?: (path: string) => Promise<H>;
    moveMany?: (from: string[], to: string[], options?: MoveOptions) => Promise<void>;
    copyMany?: (from: string[], to: string[], options?: CopyOptions) => Promise<void>;
    putHeads?: (newHeads: H[]) => Promise<void>;
    extractDir?: (head: H | null) => string;
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

    protected _extractDir?: (head: H | null) => string | null;

    extractDir(head: H | null): string | null {
        return this._extractDir?.(head) ?? HFSApi.dirName(head?.path ?? "/");
    }

    constructor(
        private _adapter: HFSAdapter<H, D>,
        private _dispatch: <T extends HFSEventType>(type: T, ...data: HFSEventData<T>) => void
    ) {}

    private async _run<R>(
        path: string | string[] | null,
        action: Action,
        prom: Promise<R> | (() => Promise<R>)
    ): Promise<R> {
        const actionId = genId();
        const paths = () => {
            if (!path) return null;
            if (typeof path === "string") return [path];
            return path;
        };

        this._dispatch("actionStart", paths(), action, actionId);

        try {
            let result: R;
            if (prom instanceof Promise) result = await prom;
            else result = await prom();
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
        return this._run(path, Action.list, this._adapter.list(path, options));
    }

    head(path: string): Promise<H | null> {
        return this._run(path, Action.head, this._adapter.head(path));
    }

    heads(paths: string[]): Promise<H[]> {
        if (!this._adapter.heads) throw new Error("Not implemented");
        return this._run(paths, Action.heads, this._adapter.heads(paths));
    }

    async exists(path: string): Promise<boolean> {
        const head = await this.head(path);
        return !!head;
    }

    async putHead(data: H): Promise<void> {
        if (!this._adapter.putHead) throw new Error("Not implemented");
        await this._run(data.path, Action.putHead, this._adapter.putHead(data));
        this._dispatch("headChange", data.path);
    }

    get(path: string, options?: GetOptions): Promise<D | undefined> {
        if (!this._adapter.get) throw new Error("Not implemented");
        return this._run(path, Action.get, this._adapter.get(path, options));
    }

    async post(path: string, head: H, data: D | undefined, options?: PostOptions): Promise<void> {
        if (!this._adapter.post) throw new Error("Not implemented");

        await this._run(path, Action.post, async () => {
            if (!options?.overwrite && (await this.exists(path)))
                throw new Error("Destination already exists");
            await this._adapter.post!(path, head, data, options);
        });

        this._dispatchCreate([path]);
        this._dispatch("dataChange", path);
    }

    async put(path: string, data: D, options?: PutOptions): Promise<void> {
        if (!this._adapter.put) throw new Error("Not implemented");
        await this._run(path, Action.put, this._adapter.put(path, data, options));
        this._dispatch("dataChange", path);
    }

    async remove(path: string, options?: DeleteOptions): Promise<void> {
        if (!this._adapter.remove) throw new Error("Not implemented");
        await this._run(path, Action.remove, this._adapter.remove!(path, options));
        this._dispatchRemove([path]);
    }

    async removeMany(paths: string[], options?: DeleteOptions): Promise<void> {
        if (!this._adapter.removeMany) throw new Error("Not implemented");
        await this._run(paths, Action.removeMany, this._adapter.removeMany(paths, options));
        this._dispatchRemove(paths);
    }

    async move(from: string, to: string, options?: MoveOptions): Promise<void> {
        if (from === to) return;

        if (!this._adapter.move) throw new Error("Not implemented");

        await this._run([from, to], Action.move, async () => {
            if (!options?.overwrite && (await this.exists(to))) throw new Error("Destination already exists");
            await this._adapter.move!(from, to, options);
        });

        this._dispatchRemove([from], [to]);
        this._dispatchCreate([to], [from]);
    }

    async copy(from: string, to: string, options?: CopyOptions): Promise<void> {
        if (from === to) return;

        if (!this._adapter.copy) throw new Error("Not implemented");

        await this._run([from, to], Action.copy, async () => {
            if (!options?.overwrite && (await this.exists(to))) throw new Error("Destination already exists");
            await this._adapter.copy!(from, to, options);
        });

        this._dispatchCreate([to], [from]);
    }

    async mkdir(path: string): Promise<H> {
        if (!this._adapter.mkdir) throw new Error("Not implemented");

        const newHead = await this._run(path, Action.mkdir, async () => {
            if (await this.exists(path)) throw new Error("Destination already exists");
            return this._adapter.mkdir!(path);
        });

        this._dispatchCreate([path]);
        return newHead;
    }

    async moveMany(from: string[], to: string[], options?: MoveOptions): Promise<void> {
        if (!this._adapter.moveMany) throw new Error("Not implemented");

        if (!from.length) return;

        await this._run([...from, ...to], Action.moveMany, async () => {
            if (from.length !== to.length) throw new Error("Invalid arguments");
            await this._adapter.moveMany!(from, to, options);
        });

        this._dispatchRemove(from, to);
        this._dispatchCreate(to, from);
    }

    async copyMany(from: string[], to: string[], options?: CopyOptions): Promise<void> {
        if (!this._adapter.copyMany) throw new Error("Not implemented");

        if (!from.length) return;

        await this._run([...from, ...to], Action.copyMany, async () => {
            if (from.length !== to.length) throw new Error("Invalid arguments");
            await this._adapter.copyMany!(from, to, options);
        });

        this._dispatchCreate(to, from);
    }

    async putHeads(newHeads: H[]): Promise<void> {
        if (!this._adapter.putHeads) throw new Error("Not implemented");

        if (!newHeads.length) return;

        const paths = newHeads.map((h) => h.path);
        await this._run(paths, Action.putHeads, this._adapter.putHeads(newHeads));

        paths.forEach((path) => this._dispatch("headChange", path));
    }

    private async _heads(paths: string[]): Promise<H[]> {
        if (this._adapter.heads) {
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
