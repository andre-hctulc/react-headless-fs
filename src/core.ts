import { EntryStatus, HeadBase } from "./types";

function deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * A tree structure that represents the file system.
 * @template H The head type
 * @param path The id of the entry
 * @param data Must be _serializable_
 */
export class HFSTree<H extends HeadBase = HeadBase> {
    private _data: H | null;
    /** `Map<entryId, entry>` */
    readonly _children: Map<string, HFSTree<H>> = new Map();
    readonly all: Map<string, HFSTree<H>> = new Map();
    private _status: EntryStatus = { loading: false, open: false, error: null };
    readonly id = Math.random().toString(36).substring(7);

    constructor(
        readonly path: string,
        data: H | null,
        children?: HFSTree<H>[],
        readonly root: boolean = false,
        defaultStatus?: Partial<EntryStatus>
    ) {
        this._data = data;
        if (defaultStatus) this._status = { loading: false, open: false, error: null, ...defaultStatus };
        children?.forEach((child) => this._children.set(child.path, child));
        if (this.root) {
            this.all.set(path, this);
        }
    }

    toString() {
        return `HFSTree('${this.path}', ${this._data?.isDir ? "d" : "f"}, [${this._children.size}], ${
            this.id
        })`;
    }

    get data(): H | null {
        return this._data;
    }

    /** Updates the node fata */
    update(node: H) {
        this._data = node;
    }

    /** Updates the status */
    updateStatus(status: Partial<EntryStatus>) {
        this._status = { ...this._status, ...status };
    }

    get status() {
        return this._status;
    }

    appendChild(head: H): HFSTree<H> {
        let current = this._children.get(head.path);
        if (current) {
            current.update(head);
            return current;
        }
        this._children.set(head.path, (current = new HFSTree(head.path, head)));
        return current;
    }

    append(heads: H[]): HFSTree<H>[] {
        return heads.map((child) => this.appendChild(child));
    }

    /** Removes all children */
    clear() {
        this._children.clear();
    }

    /** Resets the status */
    reset() {
        this._status = { loading: false, open: false, error: null };
    }

    children() {
        return Array.from(this._children.values());
    }

    find(path: string): HFSTree<H> | null {
        if (this.root) return this.all.get(path) || null;

        if (this.path === path) return this;

        for (const child of this._children.values()) {
            const found = child.find(path);
            if (found) return found;
        }
        return null;
    }

    removeChild(...paths: string[]) {
        paths.forEach((path) => this._children.delete(path));
    }

    /**
     * @returns removed?
     */
    remove(path: string): boolean {
        if (this.root) this.all.delete(path);

        if (this.path === path) {
            this._data = null;
            this._status = { loading: false, open: false, error: null };
            return true;
        } else if (this._children.has(path)) {
            this.removeChild(path);
            return true;
        } else {
            return this.children().some((child) => child.remove(path));
        }
    }

    removeMany(paths: string[]): boolean {
        return paths.some((path) => this.remove(path));
    }

    /**
     * @returns Inserted as child?
     */
    insert(dir: string | null, head: H): HFSTree<H> | null {
        // When no dir given, insert to root
        if (dir === null) {
            if (this.root) this._data = head;
            return this;
        }

        let newChild: HFSTree<H> | null = null;

        if (this.path === dir) {
            newChild = this.appendChild(head);
        } else {
            for (const child of this.children()) {
                newChild = child.insert(dir, head);
                if (newChild) break;
            }
        }

        if (newChild && this.root) this.all.set(newChild.path, newChild);

        return newChild;
    }

    insertMany(dir: string | null, heads: H[]): HFSTree<H>[] | null {
        // Cannot insert many to root
        if (dir === null) return null;

        let newChildren: HFSTree<H>[] | null = null;

        if (this.path === dir) {
            newChildren = this.append(heads);
        } else {
            for (const child of this.children()) {
                newChildren = child.insertMany(dir, heads);
                if (newChildren) break;
            }
        }

        if (newChildren && this.root) newChildren.forEach((child) => this.all.set(child.path, child));

        return newChildren;
    }

    copy(): HFSTree<H> {
        const tree = new HFSTree<H>(this.path, deepCopy(this._data), this.children(), this.root, {
            ...this._status,
        });
        return tree;
    }
}
