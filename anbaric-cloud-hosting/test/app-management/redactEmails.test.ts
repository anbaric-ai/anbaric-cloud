import {describe, expect, it} from "vitest";
import {redactEmails} from "../../src/app-management/redactEmails";

describe("redactEmails", () => {

    it("keeps two letters of the local part and hides the rest in a fixed shape", () => {
        expect(redactEmails("Chris.scott@gmail.com")).toBe("ch****@****.**");
    });

    it("gives every address the same number of asterisks whatever its length", () => {
        expect(redactEmails("a@b.co")).toBe("a****@****.**");
        expect(redactEmails("very.long.local.part+tag@sub.domain.example.org")).toBe("ve****@****.**");
    });

    it("redacts every address in a line and leaves the rest alone", () => {
        expect(redactEmails('login ok user=Dana@example.com, invited by mulder@fbi.gov at 10:02'))
            .toBe('login ok user=da****@****.**, invited by mu****@****.** at 10:02');
    });

    it("leaves lines without an address untouched", () => {
        expect(redactEmails("job 42 moved to state review @ 3 attempts")).toBe("job 42 moved to state review @ 3 attempts");
    });

});
