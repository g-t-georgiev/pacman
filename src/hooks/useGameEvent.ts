import { useEffect, useState } from "react";
import type { EventBus } from "../core/EventBus";

/**
 * Custom React hook allowing components to subscribe to targeted game events.
 */
export function useGameEvent<T>(
  events: EventBus,
  eventName: string,
  initialState: T | (() => T)
): T {
  const [value, setValue] = useState<T>(initialState);

  useEffect(() => {
    const handleEvent = (event: CustomEvent<T>) => {
      setValue(event.detail);
    };

    events.on(eventName, handleEvent);

    return () => {
      events.off(eventName, handleEvent);
    };
  }, [events, eventName]);

  return value;
}
