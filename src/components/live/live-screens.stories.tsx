import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoLiveSnapshot } from "@/lib/live/seed";
import type { LiveStatus } from "@/lib/live/client/live-connection";
import { LiveAnnouncer } from "./live-announcer";
import { LiveBarConnected } from "./live-bar";
import { LiveProvider } from "./live-provider";
import {
  LiveGroupStandings,
  LiveMatches,
  LiveOverallStandings,
} from "./live-views";

const initial = {
  snapshot: demoLiveSnapshot("2026-06-14T08:05:00.000Z"),
  syncedAt: "2026-06-14T08:30:00.000Z",
};

/** A live screen with demo data and no connection. */
function LiveScreen({
  screen,
  status,
}: {
  screen: "live" | "girone" | "classifica";
  status: LiveStatus;
}) {
  return (
    <LiveProvider initial={initial} connect={false} initialStatus={status}>
      <div className="flex flex-col gap-stack">
        <LiveBarConnected />
        {screen === "live" ? (
          <>
            <LiveAnnouncer types={["score", "group-standings"]} />
            <LiveMatches />
          </>
        ) : null}
        {screen === "girone" ? (
          <>
            <LiveAnnouncer groupId="a" />
            <LiveGroupStandings groupId="a" />
          </>
        ) : null}
        {screen === "classifica" ? (
          <>
            <LiveAnnouncer types={["overall-standings"]} />
            <LiveOverallStandings />
          </>
        ) : null}
      </div>
    </LiveProvider>
  );
}

const meta = {
  title: "Live/Schermate",
  component: LiveScreen,
  args: { screen: "live", status: "live" },
  argTypes: {
    screen: {
      control: "inline-radio",
      options: ["live", "girone", "classifica"],
    },
    status: {
      control: "inline-radio",
      options: ["connecting", "live", "reconnecting", "offline"],
    },
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LiveScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Partite: Story = {};

export const Girone: Story = {
  args: { screen: "girone" },
};

export const ClassificaOffline: Story = {
  args: { screen: "classifica", status: "offline" },
};
