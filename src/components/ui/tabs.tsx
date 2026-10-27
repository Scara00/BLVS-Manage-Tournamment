"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

/**
 * BLVS tabs (R-68): black underline on the active tab, square corners.
 * Base UI provides the tablist/tab/tabpanel roles, roving tabindex and
 * Arrow/Home/End keys. Horizontal only.
 */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex min-w-0 flex-col gap-stack", className)}
      {...props}
    />
  );
}

/**
 * Arrow keys select the tab they move to (automatic activation). The list
 * scrolls horizontally when the tabs do not fit, so the page never does.
 */
function TabsList({
  className,
  activateOnFocus = true,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      activateOnFocus={activateOnFocus}
      className={cn(
        "flex w-full max-w-full [scrollbar-width:thin] overflow-x-auto overscroll-x-contain border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-space-2 rounded-none px-space-4 py-space-3 font-sans text-base font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        "data-active:text-foreground",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 data-active:after:opacity-100",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 font-sans text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
