import type { ApiEvents } from "./adapter";
import { HeadBase } from "./types";

/**
 * @template H Header type
 * @template D Data type
 */
export type HFSEvents<H extends HeadBase = HeadBase, D = any> = ApiEvents<H, D> & {};

export type HFSEventData<T extends HFSEventType, H extends HeadBase = HeadBase, D = any> = HFSEvents<
    H,
    D
>[T] extends any[]
    ? HFSEvents<H, D>[T]
    : [];

export type HFSEventType = keyof HFSEvents;

export type HFSEventListener<
    T extends HFSEventType = HFSEventType,
    H extends HeadBase = HeadBase,
    D = any
> = (event: HFSEvent<T, H, D>) => void;

/**
 * @template H Header type
 */
export class HFSEvent<T extends HFSEventType = HFSEventType, H extends HeadBase = HeadBase, D = any> {
    constructor(readonly type: T, readonly data: HFSEventData<T, H, D>) {}

    #defaultPrevented = false;

    peventDefault(): void {
        this.#defaultPrevented = true;
    }

    get defaultPrevented() {
        return this.#defaultPrevented;
    }
}
