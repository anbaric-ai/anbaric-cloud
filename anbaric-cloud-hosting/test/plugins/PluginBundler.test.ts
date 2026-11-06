import {describe, expect, it} from "vitest";
import {browserReplacement, serverReplacement} from "../../src/plugins/PluginBundler";

describe("PluginBundler replacements", () => {

    it("hands a plugin the dashboard's own copy of a design-system brand asset", () => {
        expect(browserReplacement("@anbaric/design-system/shared/assets/anbaric-logo.svg"))
            .toBe('module.exports = window.AnbaricPluginRuntime.assets["anbaric-logo.svg"] ?? "";');
        expect(serverReplacement("@anbaric/design-system/shared/assets/anbaric-logo.svg")).toBe('module.exports = "";');
    });

    it("still hands design-system components to the dashboard's runtime", () => {
        expect(browserReplacement("@anbaric/design-system/components/Button")).toBe("module.exports = window.AnbaricPluginRuntime.DesignSystem;");
        expect(serverReplacement("@anbaric/design-system/components/Button")).toBe("module.exports = {};");
    });

});
