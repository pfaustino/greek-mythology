# Greek Mythology

**Live:** https://pfaustino.github.io/greek-mythology/

An educational documentary chronology of classical Greek myth. The screen is one composition: a starry firmament, the ridge of Olympus, and the wine-dark sea. Episodes advance along an arc in the sky. A tablet tells the story, and a UK voice reads it.

This is a fan chronology for learning the old stories. It is not a film, game, or modern retelling, and it is not affiliated with any of those.

```bash
npm install
npm run dev
```

## Controls

| Action | How |
| --- | --- |
| Pause / play | Space, or **Pause** |
| Play forward | **Forward** |
| Play backward | **Reverse** |
| Previous / next episode | Arrow keys, or **Previous** / **Next** |
| Jump | Timeline scrubber, or click a star on the arc |
| Filter | **Filter the chronicle** — era and kind |
| Narration | **Speak** (on by default). **Silent** turns it off |

Pause pauses speech. Narration tries Microsoft’s Ryan voice through the Edge read-aloud service, then falls back to a UK male voice in the browser. The first spoken line may wait until you click or press a key, because browsers block audio until then.

## Chronology

Mythic time is not a calendar. There are no BCE dates. The telling uses five eras, in this order:

1. **Cosmogony** — Chaos through the birth and rescue of Zeus
2. **Titanomachy** — the war with the Titans, Typhon, and the division of the world
3. **Olympian age** — fire, humankind, the great divine episodes
4. **Heroic age** — Perseus, Heracles, Theseus, the Argo, Thebes, Orpheus
5. **Trojan cycle** — the apple of Eris through Orestes in Athens

Inside an era, `order` is the sequence this chronicle uses. Heroic tales overlap in the ancient sources (Heracles meets Theseus below; Heracles sails for a time on the Argo). The sequence is a teaching order, and the tablet says so when the stories fold.

Names follow familiar Hellenic forms (Kronos, Heracles, Dionysos, Poseidon). A few heroes keep the usual English spelling (Achilles, Hector, Helen, Oedipus) so the voice can say them clearly. Where Latin tradition used another name, the tablet notes it.

## Run, test, build

```bash
npm run dev       # local site
npm test          # catalog and playback checks
npm run check     # typecheck, tests, and production build
npm run build     # writes dist/ for GitHub Pages
npm run preview   # serves the production build
```

The dev server exposes `/api/tts` so narration can be synthesized from Node during local playback. The production build speaks from the browser instead.

## Deploy

GitHub Pages is set up in `.github/workflows/deploy.yml`. On a push to `main`, Actions builds `dist/` and deploys it. In the repo settings, set Pages to **GitHub Actions**.

The production base path is `/greek-mythology/`, matching this folder name. If the repository name changes, update `base` in `vite.config.ts`.

## Sources and what this is not

Narration is original summary, written for this app. It is not a translation of a modern book, script, or article, and it is not Wikipedia text pasted onto the tablet.

The episodes follow the outlines in public-domain classical works and the common scholarly shape of the myths:

- Hesiod, *Theogony* and *Works and Days*
- Homer, *Iliad* and *Odyssey*
- The Homeric Hymns
- Apollodorus, *Library*
- The tragic plays of Aeschylus, Sophocles, and Euripides named on each tablet
- Apollonius, *Argonautica*
- Ovid, *Metamorphoses*, where a famous episode is mainly told there (Phaethon, Icarus, Orpheus)
- Summaries of the Epic Cycle where the Trojan story continues past the *Iliad*

Ancient authors disagree. Where that matters (Helen in Egypt, Iphigenia replaced by a deer, Medea’s children, Achilles’ heel), the narration says so instead of pretending there is one authorized version.

Each tablet has a further-reading link to the relevant English Wikipedia article. The article’s lead image sits at the top of the tablet, and any further images from that article sit under the narration. The article text stays on Wikipedia. The cosmos behind the tablet is drawn in the browser: gradients, a ridge, a sea, stars, and a few geometric signs. There is no globe and no imagery from modern films or games.

## Stack

Vite and TypeScript. Playback, filters, and spoken narration follow the same ideas as [Calamity Atlas](https://pfaustino.github.io/calamities/), with a mythic cosmos in place of the earth.
