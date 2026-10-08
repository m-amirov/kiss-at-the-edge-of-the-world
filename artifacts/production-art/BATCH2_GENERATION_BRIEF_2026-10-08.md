# Production Art Batch 2 — generation brief

Date: 2026-10-08
Run: `2026-10-08T04-43-32-234Z-production-art-cb403f`
Starting HEAD: `6d17ab03bf656d07b580025facf18040bf18db98`
Locked scope: exactly six new integrated full-scene CGs. No REFRAME_STAGE state is in scope.

## Canonical references

Character identity masters (PNG, each 1024x1536):

- `assets/characters/alice-master.png` — SHA-256 `D261C464D1D40913E3BD377B206B9D59E86310ECFBEDC0357D6FE4DEF1179D5D`
- `assets/characters/nick-master.png` — SHA-256 `A1C4AAE9230B21A7CE9EAF4605A62ED54E225E35AB1B2470049902A63FE44FDD`
- `assets/characters/eric-master.png` — SHA-256 `AA66CC7E0A58BD409B1066DBC07CD5780796245FD79A7EB5C8E0FB98F0322F14`
- `assets/characters/damir-master.png` — SHA-256 `221DF2CDD61880DE169B500FA56095C99C9784595D156201EE65F15F76C69EF3`

Environment references:

- `assets/backgrounds/keflavik-airport-arrivals-v1.png` — 1672x941, SHA-256 `20D598392AD68F96C9F3FF1EFAA416CDB1430F9DD381569706FB778E1F447F8D`
- `assets/backgrounds/road-trip-van-interior-rain.png` — 1672x941, SHA-256 `DBD19409C079C98E0141818E85935AE84ED14655D2897C0400953191D5A7C269`
- `assets/backgrounds/guesthouse-common-kitchen-evening.png` — 1672x941, SHA-256 `F6C3E566BAF906961A9540D927F73477DCD1734CD8850051A1ABCE31AF9E2FB8`
- `assets/backgrounds/s26-eastfjords-guesthouse-courtyard.png` — 1920x900, SHA-256 `F165BD26A68F0C9C1AB1D4EC73D6FC6D28780FE9004FD5F965E781BC71ED9431`

Preserve face identity, age, hair, silhouette, wardrobe, accessories and narratively relevant props from the masters and adjacent approved production references. No baked UI, captions, readable signage, logos, watermarks or invented characters.

## Cue ledger

### 1. S01 / `airport-outside` — P0

- Runtime position: `position=9`, source `S01.C000.P016`, current presentation `environment/group`, current background `keflavik-airport-arrivals-v1.webp`.
- Exact physical cast: Alice, Nick, Eric. Damir is not present yet and must not appear.
- Surrounding authored paragraphs: P012–P015 are Nick/Alice banter after baggage claim; P016 describes near-horizontal rain beyond the glass doors, Eric by the exit with the rental employee, Eric catching a wind-pushed baggage cart and looking to Alice; P017–P023 are Eric/Nick arrival banter and Alice asking whether there are four of them; P024 is the later Damir reveal and belongs to the next cue.
- Beat: first shared airport threshold; Eric is the grounded group lead, Nick is the camera-carrying comic counterpoint, Alice is the arriving journalist with luggage.
- Acting/blocking: medium group cinematic frame, natural triangular conversation; Eric physically anchors the cart/exit plane, Nick remains visibly connected to camera and baggage, Alice retains agency and readable face. Do not line up equal-height figures.
- Location/time/weather: Keflavík arrivals exit, day 1 morning, hard horizontal rain and cold overcast airport light.
- Props: Alice's red suitcase, Nick's camera, airport baggage cart, rental/arrival threshold.
- Continuity: Alice's yellow rain shell and burgundy scarf; Nick's dark travel layers and camera; Eric's dark coat and travel bag. Preserve airport interior/exterior geography and floor reflections.
- Defect repair: integrated characters/environment, credible floor contact and scale, shared cool/wet lighting, non-artificial spacing, group large enough for the environment.
- Proposed files: `assets/cg/s01-airport-outside-batch2.png`, `assets/cg/s01-airport-outside-batch2.webp`, `assets/cg/s01-airport-outside-batch2-portrait.webp`.

### 2. S01 / `damir-arrives` — P0

- Runtime position: `position=14`, source `S01.C000.P024`, current presentation `environment/group`, current background `keflavik-airport-arrivals-v1.webp`.
- Exact physical cast: Alice, Nick, Eric, Damir. All four are present.
- Surrounding authored paragraphs: P021–P023 close Eric's handoff of luggage and the joke about the group; P024 introduces Damir at the coffee machine by the way he holds the paper cup and by Alice recognizing the old grey scarf; P025 is Damir's one-breath freeze; P026–P030 are the restrained greeting, Nick noticing the camera is inappropriate, Eric asking whether they know each other, Alice answering “Были”, and Damir putting down the coffee.
- Beat: Damir's arrival is the focal interruption in an already formed airport group; the image must make his arrival legible through depth and gaze, not text.
- Acting/blocking: foreground/midground/focal arrival; Damir near the coffee machine and slightly separated by a believable aisle, Alice and the existing group turn toward him, Nick's camera lowered, Eric observing without crowding. No four-person lineup and no equal spacing.
- Location/time/weather: same Keflavík arrivals exit, day 1 morning, rain beyond the glass and cool airport interior light.
- Props: Damir's paper coffee cup, old grey scarf, Alice's suitcase, Nick's camera, shared bags and cart.
- Continuity: same clothing as the immediately preceding S01 cue; Damir's established darker hair/medical-travel styling and shoulder bag; no later-road wardrobe.
- Defect repair: arrival focal hierarchy, integrated floor/lighting, believable scale and shared perspective for all four.
- Proposed files: `assets/cg/s01-damir-arrives-batch2.png`, `assets/cg/s01-damir-arrives-batch2.webp`, `assets/cg/s01-damir-arrives-batch2-portrait.webp`.

### 3. S48 / `scene-start` — P0

- Runtime position: `position=0`, source `S48.C000.P000`, current presentation `environment/group`, current background `guesthouse-common-kitchen-evening.webp`.
- Exact physical cast: Alice, Eric, Nick, Damir. All four are physically present at the last shared breakfast.
- Surrounding authored paragraphs: P000 establishes the same small kitchen, the group now knowing its routines, Nick knowing the cup drawer, Damir no longer cooking without asking, Eric sitting before checking the car, and Alice placing the Icelandic kitchen book beside bread; P001 has Nick asking permission for one shared photograph and all four agreeing, with the imperfect third frame selected. The authored cue `group-hotel-exit` at C005 is a later door/vehicle transition and remains a separate cue.
- Beat: calm, earned last shared breakfast before departure; the group is together without a forced hero center.
- Acting/blocking: one coherent kitchen tableau around table/book/bread; Nick can prepare the timer/camera from a natural position while still part of the group, Alice owns the book and social center, Eric and Damir are grounded in the breakfast routine. Leave readable headroom for runtime chrome.
- Location/time/weather: small Icelandic guesthouse kitchen, day 21 morning, cold daylight with warm practical interior light and wet departure weather outside.
- Props: bread, Icelandic kitchen book, cups, table, camera/timer, travel bags only if they belong naturally near the exit.
- Continuity: final travel-day clothing and established faces; do not use the older exit asset as a substitute for this breakfast beat.
- Defect repair: shared table grounding, integrated warm/cool lighting, group scale and purposeful spacing.
- Proposed files: `assets/cg/s48-last-breakfast-batch2.png`, `assets/cg/s48-last-breakfast-batch2.webp`, `assets/cg/s48-last-breakfast-batch2-portrait.webp`.

### 4. S26 / `scene-start` — P0

- Runtime position: `position=0`, source `S26.C000.P000`, current presentation `environment/group`, current background `s26-eastfjords-guesthouse-courtyard.webp`.
- Exact physical cast: Alice, Eric, Nick, Damir. All four are physically nearby in the courtyard; the subsequent authored cue at P002 is the same group-choice context.
- Surrounding authored paragraphs: P000 says the group is preparing to leave for Egilsstaðir, the kitchen power is out, Alice returns for her notebook and finds it beside the stained map; P001 has her deleting the too-neat sentence about the closed road and choosing the conversation over work; P002 places Eric at the car with the map, Nick drinking water by the steps, and Damir returning the empty pot to the host. This is the setup for the route-choice conversations, not a generic travel portrait.
- Beat: Alice claims decision-making agency while the three men are each occupied nearby; the image should stage that tension and proximity without turning it into a romantic resolution.
- Acting/blocking: Alice foreground/center-left with notebook and map, three men distributed by real courtyard anchors (car, steps, doorway/pot) at different depths; gaze and body orientation support a shared imminent conversation. Keep all four visible and readable.
- Location/time/weather: Eastfjords guesthouse courtyard, day 12 evening, power-outage dusk/blue ambient light with warm spill from the entrance, damp/cold Icelandic air.
- Props: notebook, paper map with dried butter mark, car/trunk, water bottle, empty cooking pot.
- Continuity: established travel wardrobe and backpacks; retain the guesthouse/courtyard geography and avoid reusing an unrelated dramatic embrace composition.
- Defect repair: integrated courtyard perspective, floor/step contact, mixed dusk/practical lighting, purposeful depth spacing and group scale.
- Proposed files: `assets/cg/s26-route-choice-courtyard-batch2.png`, `assets/cg/s26-route-choice-courtyard-batch2.webp`, `assets/cg/s26-route-choice-courtyard-batch2-portrait.webp`.

### 5. S02 / `scene-start` — P1

- Runtime position: `position=0`, source `S02.C000.P000`, current presentation `environment/group`, current background `road-trip-van-interior-rain.webp`.
- Exact physical cast: Alice, Eric, Nick, Damir. All four are physically inside the moving van. Current runtime evidence confirms this state is environment/group; later conditional S01 car states are cinematic and must not be conflated with this cue. The later S02 `roadside-cafe` cue at P031 remains out of scope.
- Surrounding authored paragraphs: P000 begins after the baggage/location talk, with only windshield wipers; P001 has Nick connecting his phone and leaving Icelandic radio on; P002–P003 are Alice asking if the song is about love and Eric answering about a tax return; P004–P007 continue the dry group exchange and Eric's rare smile.
- Beat: first shared van silence softens into a dry group joke; travel intimacy is carried by windshield rain, dashboard space and glances between rows.
- Acting/blocking: integrated interior perspective from the dashboard/center aisle; Eric owns the driving plane, Alice reads forward/sideways, Nick leans between seats with phone/camera, Damir remains a real rear-seat participant. No pasted bodies over the road background and no tiny four-body lineup.
- Location/time/weather: van on the road to Reykjavík, day 1 daytime, heavy rain on windshield, grey Icelandic coastal light.
- Props: steering wheel/dashboard, phone/radio, route printout introduced shortly after, seat belts and travel bags only where naturally visible.
- Continuity: same arrival-day travel clothing and all four established identities; preserve the moving-road perspective. Do not replace the later valid roadside-cafe state.
- Defect repair: one coherent van interior, correct occlusion/seating depth, shared rain light and readable group scale.
- Proposed files: `assets/cg/s02-van-group-batch2.png`, `assets/cg/s02-van-group-batch2.webp`, `assets/cg/s02-van-group-batch2-portrait.webp`.

### 6. S60 / `scene-start` — P1

- Runtime position: `position=0`, source `S60.C000.P000`, current presentation `environment/group`, current background `guesthouse-common-kitchen-evening.webp`.
- Exact physical cast: Alice, Eric, Nick, Damir. All four are physically seated/standing around the common kitchen table.
- Surrounding authored paragraphs: P000 has the kitchen lights fail as Nick opens groceries; the host brings portable lamps, the stove is unavailable, and the four settle with bread, cheese and thermos tea while Damir puts lemon on bread in the dark; P001 has Alice produce a postcard, Eric a wooden bird, Nick the glove-shipping receipt and Damir a small chocolate, beginning the exchange of absurd souvenirs.
- Beat: intimate comic blackout and keepsake exchange, with the portable lamps and table objects carrying the scene's warmth.
- Acting/blocking: integrated table group under portable-lamp pools; Alice owns the exchange center, each friend visibly owns one souvenir, Nick's groceries and Damir's lemon joke remain readable. Use a layered seated/standing arrangement, not four spaced full bodies.
- Location/time/weather: guesthouse common kitchen, day 19 evening, power outage with warm portable lamps against cool dark windows/rain.
- Props: portable lamps/flashlight, bread, cheese, thermos cups, postcard, wooden bird, mailing receipt, chocolate and lemon.
- Continuity: late-trip travel wardrobe and canonical faces; preserve kitchen architecture and warm/cool lighting logic from the approved environment reference.
- Defect repair: table/floor grounding, lamp-driven shared lighting, object ownership, scale and conversational spacing.
- Proposed files: `assets/cg/s60-souvenir-kitchen-batch2.png`, `assets/cg/s60-souvenir-kitchen-batch2.webp`, `assets/cg/s60-souvenir-kitchen-batch2-portrait.webp`.

## Generation and acceptance contract

Generate sequentially in this order: S01 airport-outside, accept/rework; S01 damir-arrives, accept/rework; S48; S26; S02; S60. Each scene requires a source master PNG, desktop WebP and portrait WebP, raw-asset inspection, temporary runtime integration, current-head captures at 1920x900 and 390x844, and exact cue-to-pixel readback. Reject any extra/missing character, identity drift, malformed anatomy, baked text/logo/watermark, weak grounding, artificial spacing, or mobile crop that hides faces/props behind HUD/dialogue. 

Existing Batch 1 assets S03, S18, S42, S44 and S46 are protected byte-for-byte. Existing S26/S48 assets remain on disk; only the six exact Batch 2 mappings may be added/changed.
