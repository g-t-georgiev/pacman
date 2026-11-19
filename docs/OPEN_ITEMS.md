# Open items

What is still open, and nothing else. The finished plans are in [`docs/history/`](history/)
(the key to the plan IDs in code comments); how the game works is in the [manual](manual/).

## Closing an item

1. Change the value: each item names the constant that sets it. Remove its "estimate" mark in
   the code if a source or footage now backs it.
2. Update the manual's [Estimates and open questions](manual/03-arcade-rules.md#estimates-and-open-questions)
   (and the rule's own section if it describes the value).
3. If play changed, run `vp run golden:update`: it re-records the golden replays and bumps
   `RULES_VERSION` by itself.
4. Tick the item here with the date and the source, or delete it.

## Waiting on footage of the original

No published source has these; they need someone to watch and listen to the original game.
Current value, then the constant that sets it.

- [ ] **Energizer look.** Now a smooth pulse in size (`ENERGIZER_PULSE_FRAMES`, `GameRenderer.ts`).
      Decided: a different effect, once we know which. Check: what an energizer does during play
      (blink on and off, or a color shift), its rhythm, and whether it changes during READY, while
      paused or while the ghosts are blue.
- [ ] **When the start tune plays.** Now on a new game and on Restart Level, with a 4 s READY; a
      level after a clear and a life after a death start with a silent 2 s READY. Proposed: also at
      every level start. Check: a new game, the start of level 2, a respawn; whether the tune
      plays and how long READY lasts in each. (`startFresh` emits `INTRO`; a level start would emit
      it too and use `READY_FRAMES_GAME_START`.)
- [ ] **Ghost house release overlap.** From level 2 Inky (and from level 3 Clyde) is released a
      frame or two after Pinky and they walk out overlapping, as the Dossier's rules give (Pinky
      out 0.63 s into play, Inky and Clyde 1.10 s on level 3+). Felt too early in play. Check:
      level 2+ starts on the original, or a reliable, legally usable source on release timing
      inside the house.
- [ ] **READY lengths.** 4 s at a game's start (`READY_FRAMES_GAME_START`), 2 s otherwise
      (`PHASE_FRAMES.READY`).
- [ ] **Death.** Freeze 1 s (`DEATH_FREEZE`), animation 1.5 s (`DEATH_ANIM`), blank wait 1 s
      (`DEATH_WAIT`). The death sound lasts as long as the animation.
- [ ] **Level clear.** Freeze 1 s (`LEVEL_CLEAR_FREEZE`), then 4 white flashes, 12 frames per
      toggle (`MAZE_FLASH_TOGGLE_FRAMES`, `MAZE_FLASH`).
- [ ] **Blinks.** 1UP: 16 frames per toggle (`HUD_LAYOUT.oneUpBlinkFrames`). The frightened
      warning: 14 frames per white/blue half-cycle (`FRIGHTENED_FLASH_TOGGLE_FRAMES`).
- [ ] **Which way the waiting ghosts start.** Now Pinky up, Inky and Clyde down, at every level
      start and new life (`initialDir` in `mazes.ts`), as seen in play (2026-11-19); before, all
      three went up in step. Another recollection has it the other way round (Pinky down, Inky and
      Clyde up); no published source says. Check on footage: the first frames after READY.
- [ ] **Speeds without a source.** The eyes going home: 2 px every frame
      (`GHOST_EATEN_SPEED_PCT`). Inside the house: 50% (`GHOST_HOUSE_SPEED_PCT`). How far waiting
      ghosts bob: half a tile (`HOUSE_BOB`).
- [ ] **The siren.** Where it steps up: 20/40/60/80% of the dots eaten
      (`SIREN_STAGE_SHARE_EATEN`); each siren's pitch range and sweep rate (`SIREN_STAGES`,
      `FRIGHTENED_SIREN`, `EYES_SIREN`).
- [ ] **Other sounds by ear.** Chomp pitch and length per dot; eating a ghost or fruit, the extra
      life, death (`SoundEngine.ts`).
- [ ] **Pac-Man's mouth.** The frame he stops on against a wall (half open now) and the pixels per
      chomp (8 now; `MOUTH_FRAMES`, `Pacman.ts`).

## Waiting on your decision

- [x] **The global dot counter at 32: keep the Dossier rule** (decided 2026-11-19). After a death,
      the shared counter releases Pinky at 7 and Inky at 17; at 32, if Clyde is still inside, it
      switches itself off and the personal counters take over again; if Clyde is already out, it
      keeps counting for the rest of the level, and ghosts eaten later can be held in the house
      until the no-dot timer sends them out (`HouseController`). Still unsure, see below.
- [ ] **Timer units.** The Dossier's seconds are read as 60 frames each ("1/60 s" = one frame),
      while the Arcade preset runs 60.606 frames per second, so a "second" is 0.99 real seconds.
      Unverified: keep this reading, or treat them as real seconds?

## Still unsure, to check on footage or in a reliable source

- [ ] **Does Clyde leave at 32?** The Dossier (and notes that follow it) say the shared counter is
      _switched off_ at 32 when Clyde is inside, not that it _releases_ him: he then leaves by his
      own count (at once from level 3; on levels 1 and 2 only when his frozen count reaches 60 or
      50, or by the no-dot timer). The Dossier is explicit: the personal limits decide "including
      Clyde who is still in the house at this time". A secondary source disagrees:
      [mrpacman.com](https://mrpacman.com/blog/pacman-ghost-house-rules/) says Clyde leaves at 32
      and the counter switches off when he does. Both agree from level 3 (Clyde's limit is 0, so he
      leaves at once either way); they differ only on levels 1 and 2. We keep the Dossier, the more
      precise source, until footage says otherwise. Check on footage: after a death on level 1,
      with Clyde still inside, does he come out at the 32nd dot?
- [ ] **Does the no-dot timer restart after a death?** The sources say it restarts when it fires and
      (implicitly) with every dot; none says what a death does. We restart it (`onLifeLost`), so no
      time is left over from before the death. Check on footage: right after a respawn, with
      Pac-Man not eating, does the first ghost leave after a full 4 s?

## Waiting on a source

- [ ] **The speed masks' bit layouts.** Their totals follow the Dossier's scale; which frames move
      is evenly spread for now (`speedMasks.ts`). Swap in the real patterns if a verified
      disassembly turns up.
- [ ] **Ms. Pac-Man's own mechanics.** Her semi-random first scatter, moving fruit paths, other
      mazes, and whether she has no-up tiles anywhere. Not implemented without a source.

## Not planned

Kept here so they are explicit decisions, not forgotten work: the level-256 split screen (F25),
and a MAME comparison harness (T10; no ROM set is used, by decision).
