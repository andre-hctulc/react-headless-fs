import type { HFSAdapter } from "../api";
import type {
    CopyOptions,
    DeleteOptions,
    HeadBase,
    ListOptions,
    PostManyOptions,
    PostOptions,
    PutHeadOptions,
    PutOptions,
} from "../types";

type LocalHeadBase = HeadBase & { dir?: string | null };

export type LocalFS<H extends LocalHeadBase = LocalHeadBase, D = any> = {
    path: string | null;
    data?: D | undefined;
    head: H;
    children?: Record<string, LocalFS<H, D>>;
};

export type LocalAdapterOptions<H extends LocalHeadBase = LocalHeadBase, D = any> = {
    default?: LocalFS<H, D>[];
};

/**
 * The heads must include the dir id as _dir_!
 */
export class LocalAdapter<H extends LocalHeadBase = LocalHeadBase, D = any>
    implements Required<HFSAdapter<H, D>>
{
    private _nodes = new Map<string, LocalFS<H, D>>();

    constructor(options: LocalAdapterOptions<H, D> = {}) {
        if (options.default) {
            options.default.forEach((entry) => {
                this._nodes.set(entry.head.path, entry);
            });
        }
    }

    extractDir(head: H | null) {
        return head?.dir ?? null;
    }

    getNodes(): LocalFS<H>[] {
        return Array.from(this._nodes.values());
    }

    private _get(path: string): LocalFS<H> | null {
        return this._nodes.get(path) || null;
    }

    private _setHead(path: string, head: Partial<H>, strategy: "merge" | "replace"): LocalFS<H, D> {
        let obj = this._get(path);
        if (!obj) this._nodes.set(path, (obj = { path, data: undefined as D, head: head as H }));
        if (strategy === "merge") obj.head = { ...obj?.head, ...head } as H;
        else obj.head = head as H;
        return obj;
    }

    private _setData(path: string, data: D | undefined): LocalFS<H> | null {
        let obj = this._get(path);
        // entry must exits!
        if (!obj) return null;
        else obj.data = data;
        return obj;
    }

    post(path: string, head: Partial<H>, data: D | undefined, options?: PostOptions): H {
        if (!options?.overwrite && this._get(path)) throw new Error("Already exists");
        this._setHead(path, head, "replace");
        this._setData(path, data);
        return { ...head, path } as H;
    }
    put(path: string, data: D, options?: PutOptions) {
        if (!this._get(path)) throw new Error("Not found");
        this._setData(path, data);
    }

    postMany(paths: string[], heads: Partial<H>[], data: (D | undefined)[], options?: PostManyOptions): H[] {
        return paths.map((path, i) => this.post(path, heads[i], data[i], options));
    }

    list(path: string | null, options?: ListOptions): { entries: H[]; hasNext: boolean } {
        const offset = options?.offset || 0;
        const limit = options?.limit || 10;
        const entries = Array.from(this._nodes.values())
            .slice(offset, limit)
            .filter((entry) => entry.head.dir === path)
            .map((entry) => entry.head);
        return { entries, hasNext: entries.length === limit };
    }

    get(path: string): D {
        const entry = this._get(path);
        if (!entry) throw new Error("Not found");
        return entry.data as D;
    }

    head(path: string): H {
        const entry = this._get(path);
        if (!entry) throw new Error("Not found");
        return entry.head;
    }

    remove(path: string): boolean {
        return this._nodes.delete(path);
    }

    removeMany(paths: string[], options?: DeleteOptions): boolean[] {
        return paths.map((path) => this.remove(path));
    }

    move(path: string, newPath: string, options?: { overwrite?: boolean }): void {
        if (!options?.overwrite && this._get(newPath)) throw new Error("Already exists");
        const entry = this._get(path);
        if (!entry) throw new Error("Not found");
        entry.head.path = newPath;
        this._nodes.delete(path);
        this._nodes.set(newPath, entry);
    }

    copy(path: string, newPath: string, options?: { overwrite?: boolean }): void {
        if (!options?.overwrite && this._get(newPath)) throw new Error("Already exists");
        const entry = this._get(path);
        if (!entry) throw new Error("Not found");
        this._nodes.set(newPath, { ...entry, head: { ...entry.head, path: newPath } });
    }

    copyMany(from: string[], to: string[], options?: CopyOptions): void {
        from.forEach((path, i) => this.copy(path, to[i], options));
    }

    moveMany(from: string[], to: string[], options?: CopyOptions): void {
        from.forEach((path, i) => this.move(path, to[i], options));
    }

    putHead(path: string, head: Partial<H>, options?: PutHeadOptions): H {
        return this._setHead(path, head, options?.strategy || "merge").head;
    }

    putHeads(paths: string[], heads: Partial<H>[], options?: PutHeadOptions): H[] {
        return paths.map((path, i) => this.putHead(path, heads[i], options));
    }

    heads(paths: string[]): H[] {
        return paths.map((path) => this.head(path));
    }

    mkdir(path: string, head?: Partial<H>): H {
        const h: H = { ...head, dir: path, path } as H;
        return this.post(path, h, undefined);
    }
}
