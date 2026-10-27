import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no Web Animations API; Base UI waits on it before unmounting
// closed popups and toasts. Node-environment suites have no Element at all.
if (typeof Element !== "undefined") {
  Element.prototype.getAnimations ??= () => [];
}
