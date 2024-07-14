import type { HFSEvents } from "./types";

export type HFSEventData<T extends HFSEventType> = HFSEvents[T] extends any[] ? HFSEvents[T] : [];

export type HFSEventType = keyof HFSEvents;

export type HFSEventListener<T extends HFSEventType = HFSEventType> = (event: HFSEvent<T>) => void;

/**
 * @template H Header type
 */
export class HFSEvent<T extends HFSEventType = HFSEventType> {
    constructor(readonly type: T, readonly data: HFSEventData<T>) {}

    #defaultPrevented = false;

    peventDefault(): void {
        this.#defaultPrevented = true;
    }

    get defaultPrevented() {
        return this.#defaultPrevented;
    }
}
