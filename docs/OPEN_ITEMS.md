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

## Measured on footage, to apply

Settled by the [footage of 2026-11-19](footage/2026-11-19.md), which has the measurements and
the order of the work ("Step" below). Tick each one when its step is in.

- [x] **Which way the waiting ghosts start** (step 1, done). Seen: Inky and Clyde face up and move up
      first, Pinky faces down. Ours had it the other way round since 0.2.0 (`initialDir` in
      `mazes.ts`).
- [x] **How fast waiting ghosts bob** (step 1, done). Seen: 8 px from top to bottom (as ours,
      `HOUSE_BOB`), a 0.53 s cycle, about 40%. Ours was 50%; now 40% (`GHOST_HOUSE_SPEED_PCT`).
- [ ] **READY lengths** (step 2). Seen: a new game shows about 2.2 s of "PLAYER ONE" with no
      actors, then about 1.9 s with them; after a death or a clear, about 1.8 s with the actors.
      Ours: 4 s (`READY_FRAMES_GAME_START`) and 2 s (`PHASE_FRAMES.READY`), and no "PLAYER ONE".
- [ ] **When the start tune plays** (step 2: nothing changes but the READY lengths). Seen: only
      at a new game; a level start after a clear is silent, as ours.
- [ ] **Death** (step 2). Seen: freeze 1 s, animation about 1.8 s, empty maze about 0.85 s; the
      sound about 1.5 s. Ours: 1 s (`DEATH_FREEZE`), 1.5 s (`DEATH_ANIM`), 1 s (`DEATH_WAIT`),
      the sound as long as the animation.
- [ ] **Level clear** (step 2). Seen: freeze about 1.9 s (ours 1 s, `LEVEL_CLEAR_FREEZE`); the 4
      white flashes, 12 frames per toggle, are as ours; then about 0.4 s of black screen, which
      ours doesn't have.
- [ ] **The fruit during a death** (step 3). Seen: its timer keeps running. Ours pauses it.
- [ ] **Energizer look** (step 4). Seen: a plain on/off blink, about 10 frames each, in play and
      during the death freeze; steady during READY. Ours: a pulse in size
      (`ENERGIZER_PULSE_FRAMES`, `GameRenderer.ts`).
- [ ] **The siren's first stage** (step 5). Seen: about 400–900 Hz, 0.4 s a sweep. Ours tops out
      at 640 Hz (`SIREN_STAGES`).

## Waiting on footage of the original

No published source has these; they need someone to watch and listen to the original game.
Current value, then the constant that sets it.

- [x] **Ghost house release overlap** (footage 2026-11-19). On level 2 Pinky and Inky start
      moving together and overlap on the way out, as ours does. Nothing to change.
- [ ] **Blinks.** 1UP: 16 frames per toggle (`HUD_LAYOUT.oneUpBlinkFrames`). The frightened
      warning: 14 frames per white/blue half-cycle (`FRIGHTENED_FLASH_TOGGLE_FRAMES`).
- [ ] **The eyes' speed going home.** 2 px every frame (`GHOST_EATEN_SPEED_PCT`).
- [ ] **The later sirens.** Where the siren steps up: 20/40/60/80% of the dots eaten
      (`SIREN_STAGE_SHARE_EATEN`); the later stages' pitch and sweep (`SIREN_STAGES`), and the
      frightened and eyes sirens (`FRIGHTENED_SIREN`, `EYES_SIREN`).
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

- [x] **Does Clyde leave at 32?** No (footage 2026-11-19): on level 1, after a death, Clyde
      stayed inside for dozens of dots past 32, as the Dossier's rule gives. The Dossier (and notes that follow it) say the shared counter is
      _switched off_ at 32 when Clyde is inside, not that it _releases_ him: he then leaves by his
      own count (at once from level 3; on levels 1 and 2 only when his frozen count reaches 60 or
      50, or by the no-dot timer). The Dossier is explicit: the personal limits decide "including
      Clyde who is still in the house at this time". A secondary source disagrees:
      [mrpacman.com](https://mrpacman.com/blog/pacman-ghost-house-rules/) says Clyde leaves at 32
      and the counter switches off when he does. Both agree from level 3 (Clyde's limit is 0, so he
      leaves at once either way); they differ only on levels 1 and 2. We keep the Dossier, the more
      precise source, until footage says otherwise. Check on footage: after a death on level 1,
      with Clyde still inside, does he come out at the 32nd dot?
- [x] **Does the no-dot timer restart after a death?** Yes (footage 2026-11-19): the first ghost
      left a full ~4 s after play resumed. The sources say it restarts when it fires and
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
