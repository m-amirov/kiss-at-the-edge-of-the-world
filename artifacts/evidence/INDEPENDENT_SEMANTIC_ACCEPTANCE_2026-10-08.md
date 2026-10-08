# S44 Portrait Repair & Independent Semantic Audit

Source commit under test: `04a27f977aabecfa095a2f4c8367d8b673455d60` (`release/final-rc-2026-10-08`, descendant of requested `c50dbdbe087938b9f53b6b039009dc7ca1c3e94d`).

## S44 repair

The only production change is the explicit `portraitAssetByDesktopAsset` entry:

`s44-eric-morning-harbour.webp` → `s44-eric-morning-harbour-portrait.webp`.

### Metadata consistency

- `assets/asset-manifest.json` declares the portrait derivative and runtime portrait path.
- The portrait file exists and is `941×1672`.
- The focused regression test now includes `s44-eric-morning-harbour`.

### DOM/runtime readback

- Before: mobile loaded `s44-eric-morning-harbour.webp` (`1920×900`).
- After: `360×640`, `390×844`, and `412×915` load `s44-eric-morning-harbour-portrait.webp` (`941×1672`).
- Desktop `1920×900` continues to load `s44-eric-morning-harbour.webp` (`1920×900`).
- S44 current, next page, and preceding S43 page: `edgeToEdge=true`, `overflow=false`, `internalScroll=false`, zero console/request errors.

### Real pixel inspection

- Before/after capture set: 12 frames per phase across S43 previous page, S44 current page and S44 next page at desktop, 360×640, 390×844 and 412×915.
- Faces, authored two-person action and HUD remain readable in the repaired portrait frames.
- Before evidence: `output/playwright/s44-portrait-repair/before.json` (HEAD `c50dbdbe…`).
- After evidence: `output/playwright/s44-portrait-repair/after.json` (HEAD `04a27f977…`).

### Rendered coverage

Current runtime coverage is `132/132 PASS` across 66 scenes × desktop `1920×900` and mobile `390×844`; failures: `0`. This is rendered scene/cue coverage only and is not a claim that every playback position was screenshot-verified.

S44 rows in the coverage ledger now report desktop `cg/s44-eric-morning-harbour.webp` and mobile `cg/s44-eric-morning-harbour-portrait.webp`.

Verdict: `PASS_S44_PORTRAIT_MAPPING_REPAIR`.

## Independent semantic reclassification

The historical 627 records were not reclassified by rerunning the detector as an acceptance decision.

- Historical focal records: `568`.
- Unique focal contexts after grouping by authored scene/cue, runtime location, physical cast and route/choice context: `44`.
- Historical text-group records: `59`.
- Unique exact text/source contexts after merging full duplicates: `4` (`S21`, `S23`, `S28`, `S41`).
- Runtime pixel evidence: `170` frames total, including `44` focal representatives, `4` text-group representatives, `96` neighbor frames, `22` additional mobile frames for `S18`, `S28`, `S30`, `S33`, `S34`, `S35`, `S37`, `S49`, `S52`, `S55`, and `4` S01 placard frames.

### Acceptance layers

1. **Metadata consistency:** authored visual cue, location, time, cast and choice context were compared against the source direction for each grouped context.
2. **DOM stage readback:** runtime trace and stage-character readback were captured for every representative and neighbor; no capture had runtime errors, overflow or internal scroll.
3. **Real pixel inspection:** the current screenshots and contact sheets were inspected; the 44 focal contexts retain the authored focal actors and the adjacent positions do not drop a speaking/action actor.
4. **Independent visual acceptance:** manual contextual review classified the four text groups as:
   - S21: semantic false positive; the group is described inside Alice’s draft while the live room is Alice alone.
   - S23: valid focal composition; Alice and Eric plus the folded estimate are visible.
   - S28: valid focal composition; Alice and Eric plus the map action are visible.
   - S41: valid offscreen character; the four replies are a remote video call and Alice is the local participant.

Required additional scenes `S18`, `S28`, `S30`, `S33`, `S34`, `S35`, `S37`, `S49`, `S52`, `S55` were separately pixel-reviewed at 360×640, 390×844 and 412×915 representative positions.

### S01 placard

The source text describes a cardboard sign `«АЛИСА, ЖУРНАЛИСТ»`. In all four current S01 representative frames, the airport stage shows Alice and Nick but no visible cardboard sign. This is a confirmed, separate `P2` art-polish defect; no new CG was generated and no adjacent asset was substituted.

Confirmed defects: `P0=0`, `P1=0`, `P2=1` (`S01` placard).

Unverified by this bounded audit:

- all playback positions beyond the 170 representative/neighbor pixel frames;
- live Yandex Draft/SDK/cloud/ad/moderation behavior;
- final release-candidate packaging and external Yandex acceptance.

Verdict: `PASS_INDEPENDENT_SEMANTIC_ACCEPTANCE` with the disclosed S01 `P2` art-polish follow-up and the above `NOT_VERIFIED` boundaries.

This report does not issue a release PASS.
