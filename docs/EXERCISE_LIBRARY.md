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

## Test the feature branch in Termux

From the existing clone, with no uncommitted changes:

```bash
cd "$HOME/Form-Fire"
~/.local/bin/form-fire admin backup
git fetch origin
git switch codex/exercise-animation-library
npm test
~/.local/bin/form-fire restart
```

Refresh the browser on the device. The usual `form-fire update` command follows `main`; it will not fetch newer feature-branch commits. For this branch, use `git pull --ff-only` in its checkout, run tests and restart. Keep the normal database backup procedure before testing upgrades.

Migrations 005 and 006 extend valid animation IDs while retaining exercise rows and existing client snapshots. New content packs add missing new examples once and preserve earlier customisations and removals. Returning to code older than these migrations should use a separate test database or the matching pre-upgrade backup.

## Source layout

- `public/exercise-catalog.js`: original 24 definitions and catalogue assembly.
- `public/exercise-catalog-extra.js`: additional 16 definitions and their equipment drawings.
- `public/exercise-motion.js`: figure rendering, playback and manual controls.
- `public/exercise-motion.css`: responsive guide styling.
- `src/exercise-catalog.ts`: stable validated IDs and demo exercise copy.

The application uses original SVG artwork with no runtime package dependency. The [visual reference image](exercise-preview.png) is a review aid; it is not loaded in client workouts.
