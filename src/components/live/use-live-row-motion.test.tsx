import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import { LiveProvider } from "./live-provider";
import { LiveGroupStandings } from "./live-views";
import {
  baseSnapshot,
  baseSync,
  TestEventSource,
  testConnection,
} from "./test-utils";

let media: ReturnType<typeof mockMatchMedia>;
const animate = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.animate = animate;
  // jsdom has no layout: give each row a size and a top from its position.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const index = this.parentElement
        ? [...this.parentElement.children].indexOf(this)
        : 0;
      return { width: 100, height: 40, top: index * 40 } as DOMRect;
    },
  );
});

afterEach(() => {
  media.restore();
  animate.mockReset();
  delete (Element.prototype as Partial<Element>).animate;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function renderAndReorder() {
  render(
    <LiveProvider initial={baseSync} connection={testConnection()}>
      <LiveGroupStandings groupId="a" />
    </LiveProvider>,
  );
  await act(async () => {
    TestEventSource.last!.emit("open");
    await vi.advanceTimersByTimeAsync(0);
  });
  animate.mockClear();
  const [first, second] = baseSnapshot.groups[0].rows;
  act(() =>
    TestEventSource.last!.send({
      seq: 1,
      savedAt: "2026-06-14T08:30:00.000Z",
      type: "group-standings",
      group: {
        ...baseSnapshot.groups[0],
        rows: [
          { ...second, position: 1, points: 6 },
          { ...first, position: 2 },
        ],
      },
    }),
  );
}

describe("useLiveRowMotion", () => {
  it("evidenzia e fa scorrere le righe cambiate", async () => {
    media = mockMatchMedia(false);
    await renderAndReorder();
    expect(animate).toHaveBeenCalled();
  });

  it("con riduzione del movimento niente evidenziazioni né riordino animato", async () => {
    media = mockMatchMedia(true);
    await renderAndReorder();
    expect(animate).not.toHaveBeenCalled();
  });
});
