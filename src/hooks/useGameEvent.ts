import { useEffect, useState } from "react";
import type { EventBus, GameEventMap, GameEventName } from "../core/EventBus";

/**
 * Subscribes a component to one game event and returns its latest payload. The payload type
 * comes from the event's name (`GameEventMap`).
 */
export function useGameEvent<K extends GameEventName>(
  events: EventBus,
  eventName: K,
  initialState: GameEventMap[K] | (() => GameEventMap[K])
): GameEventMap[K] {
  const [value, setValue] = useState<GameEventMap[K]>(initialState);

  useEffect(() => {
    const handleEvent = (event: CustomEvent<GameEventMap[K]>) => {
      setValue(event.detail);
    };

    events.on(eventName, handleEvent);

    return () => {
      events.off(eventName, handleEvent);
    };
  }, [events, eventName]);

  return value;
}
