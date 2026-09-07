import {afterEach, describe, expect, it, vi} from "vitest";
import {NotifierFactory} from "../src/notifications/NotifierFactory.js";

describe("NotifierFactory", () => {

    afterEach(() => {
        NotifierFactory.use(undefined);
    });

    // Nothing can be delivered from a laptop, so there is no local fallback -
    // a machine built outside a platform simply doesn't notify.
    it("has no notifier until a host registers one", () => {
        expect(NotifierFactory.instance()).toBeUndefined();
    });

    it("returns whatever the host registered", () => {
        const notifier = { notify: vi.fn(async () => {}) };

        NotifierFactory.use(notifier);

        expect(NotifierFactory.instance()).toBe(notifier);
    });

    it("lets a host clear the notifier again", () => {
        NotifierFactory.use({ notify: vi.fn(async () => {}) });

        NotifierFactory.use(undefined);

        expect(NotifierFactory.instance()).toBeUndefined();
    });

});
