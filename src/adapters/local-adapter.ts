import { HFSAdapter, HFSApi, ListOptions, PostOptions } from "../adapter";
import { HeadBase } from "../types";

export type LocalFS<H extends HeadBase = HeadBase, D = any> = {
    children: { [key: string]: LocalFS<H> };
    data: D;
    head: H;
};

export class LocalAdapter<H extends HeadBase = HeadBase, D = any> implements HFSAdapter<H, D> {
    private _target: LocalFS<H>;

    constructor(target?: LocalFS<H>) {
        this._target = target || { children: {}, data: undefined, head: { path: "/", isDir: true } as H };
    }

    private _resolvePath(path: string): LocalFS<H> | null {
        const parts = path.split("/");
        let obj: any = this._target;
        for (const part of parts) {
            if (!part) continue;
            obj = obj.children[part];
            if (!obj) return null;
        }
        return obj;
    }

    async post(path: string, head: H, data: D | undefined, options?: PostOptions): Promise<H> {
        return head;
    }

    async list(path: string, options?: ListOptions): Promise<{ entries: H[]; hasNext: boolean }> {
        const obj = this._resolvePath(path);
        if (obj) {
            return {
                entries: Object.keys(obj.children).map((key) => obj.children[key].head),
                hasNext: false,
            };
        }
        return { entries: [], hasNext: false };
    }

    async head(path: string): Promise<H | null> {
        const obj = this._resolvePath(path);
        return obj ? obj.head : null;
    }

    async rm(path: string): Promise<void> {
        const dir = HFSApi.dirName(path);
        const obj = this._resolvePath(dir);
        if (obj) delete (obj as any)[path];
    }
}
