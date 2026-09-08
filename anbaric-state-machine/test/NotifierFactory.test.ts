import {afterEach, describe, expect, it} from "vitest";
import {CloudNotifier} from "anbaric-impl-cloud";
import {NotifierFactory} from "../src/notifications/NotifierFactory.js";

describe("NotifierFactory", () => {

    afterEach(() => {
        delete process.env.ANBARIC_NOTIFIER_TYPE;
    });

    // Nothing can be delivered from a laptop, so a machine built with no
    // notifier env simply doesn't notify.
    it("has no notifier by default", () => {
        expect(NotifierFactory.instance()).toBeUndefined();
    });

    it("posts to the platform when the environment selects cloud", () => {
        process.env.ANBARIC_NOTIFIER_TYPE = "cloud";

        expect(NotifierFactory.instance()).toBeInstanceOf(CloudNotifier);
    });

    it("treats an unknown type as no notifier", () => {
        process.env.ANBARIC_NOTIFIER_TYPE = "carrier-pigeon";

        expect(NotifierFactory.instance()).toBeUndefined();
    });

});
