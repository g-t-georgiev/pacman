/**
 * Lightweight, type-safe EventBus built on EventTarget.
 * Provides decoupled publish-subscribe capabilities across the engine, controllers, and React UI.
 */
export class EventBus {
  private target = new EventTarget();

  public on<T>(eventName: string, callback: (event: CustomEvent<T>) => void): void {
    this.target.addEventListener(eventName, callback as EventListener);
  }

  public off<T>(eventName: string, callback: (event: CustomEvent<T>) => void): void {
    this.target.removeEventListener(eventName, callback as EventListener);
  }

  public emit<T>(eventName: string, detail?: T): void {
    const evt =
      typeof CustomEvent !== "undefined"
        ? new CustomEvent(eventName, { detail })
        : ({ detail } as unknown as CustomEvent<T>);
    this.target.dispatchEvent(evt);
  }
}

/** Global game events instance */
const GameEvents = new EventBus();

export default GameEvents;
