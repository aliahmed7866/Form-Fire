# Exercise library: 40 movement guides

Open **Plan studio → Exercise library** from an administrator account. Search by exercise or equipment, combine it with a body-part filter, and preview a guide. Clients see guides only alongside their assigned exercises in Plans and Today.

The 16 additions are:

| Focus | New movements |
| --- | --- |
| Chest | Incline press-up; dumbbell bench press |
| Back | Lat pulldown |
| Shoulders | Single-arm dumbbell front raise |
| Biceps | Concentration curl |
| Triceps | Lying dumbbell triceps extension |
| Core | Side plank; mountain climber |
| Legs | Bodyweight squat; goblet squat; split squat; step-up; standing leg curl |
| Glutes | Donkey kick; dumbbell sumo squat |
| Calves | Single-leg calf raise |

Every guide supports Play/Pause, half- and quarter-speed, manual next-pose changes and a position slider. Dragging the slider pauses the guide; starting playback continues from there. Starting another guide pauses the previous one. Reduced-motion preferences preserve all manual controls.

All examples are labelled starter content. Alex can edit the instructions and select a different animation, add a demonstration-video link, then explicitly publish a client version. The controls show illustrative movement, not a prescribed tempo or a timer. Some guides demonstrate one side; follow the written cues for switching sides.

## Update from main in Termux

The exercise library is included in `main` from v0.7.0. On a normal main installation:

```bash
~/.local/bin/form-fire update
```

If you previously switched to the feature branch, return to main first with a clean checkout:

```bash
cd "$HOME/Form-Fire"
git switch main
~/.local/bin/form-fire update
```

The update command backs up the database, fetches and fast-forwards `main`, runs tests, and restarts the app. Refresh the browser at the configured origin (normally `http://127.0.0.1:8085`). The feature branch remains available as a record of the work; no branch switch is needed for new installations.

Migrations 005 and 006 extend valid animation IDs while retaining exercise rows and existing client snapshots. New content packs add missing new examples once and preserve earlier customisations and removals. Returning to code older than these migrations should use a separate test database or the matching pre-upgrade backup.

## Source layout

- `public/exercise-catalog.js`: original 24 definitions and catalogue assembly.
- `public/exercise-catalog-extra.js`: additional 16 definitions and their equipment drawings.
- `public/exercise-motion.js`: figure rendering, playback and manual controls.
- `public/exercise-motion.css`: responsive guide styling.
- `src/exercise-catalog.ts`: stable validated IDs and demo exercise copy.

The application uses original SVG artwork with no runtime package dependency. The [visual reference image](exercise-preview.png) is a review aid; it is not loaded in client workouts.
