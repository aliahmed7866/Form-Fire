import type { DatabaseSync } from 'node:sqlite';
import { additionalStarterExercises, expandedStarterExercises } from './exercise-catalog.ts';

// Original, fictional examples. No clients, assignments or financial data are created.
// The marker prevents restarts or upgrades from restoring examples Alex has edited/archived.
function installPlanLibraryStarterContent(db: DatabaseSync) {
  if (db.prepare('SELECT id FROM content_packs WHERE id=?').get('plan-library-v1')) return;
  const exercises = [
    ['starter-squat','Chair squat','Lower body','A stable chair','Example cues: stand in front of a stable chair, sit back with control, then stand. Alex should adapt the range and support to the client.','squat'],
    ['starter-push','Wall press-up','Upper body','A clear wall','Example cues: place hands on the wall, bend the elbows with control, then press away. Alex should choose an appropriate stance and range.','wall-push'],
    ['starter-hinge','Hip hinge','Movement practice','No equipment','Example cues: soften the knees and move the hips back, then return to standing. Alex should review the movement with the client.','hinge'],
    ['starter-row','Supported dumbbell row','Upper body','Dumbbell and stable support','Example cues: support yourself securely, draw the dumbbell towards your side, then lower with control. Alex should choose the load and setup.','row']
  ];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [id,title,category,equipment,instructions,animation] of exercises) {
      db.prepare('INSERT OR IGNORE INTO exercises(id,title,category,equipment,instructions,animation,is_demo) VALUES(?,?,?,?,?,?,1)').run(id,title,category,equipment,instructions,animation);
    }
    const recipes = [
      ['starter-oats','Berry overnight oats','50 g rolled oats\n150 ml milk or chosen alternative\n80 g berries\n1 tbsp plain yoghurt','1 example serving','Stir the oats, milk and yoghurt together. Cover and chill overnight. Add berries before serving.','Use suitable milk and yoghurt alternatives after checking the client’s requirements.'],
      ['starter-chickpeas','Lemony chickpea bowl','120 g cooked chickpeas\n100 g cooked rice\nHalf a cucumber\n1 tomato\nLemon juice\n1 tsp olive oil','1 example serving','Prepare rice according to its packet instructions. Chop the vegetables. Combine with chickpeas, lemon juice and olive oil.','Swap rice for a preferred grain; adjust ingredients and amounts with Alex.'],
      ['starter-pasta','Tomato & white bean pasta','75 g dry pasta\n120 g cooked white beans\n150 g chopped tomatoes\nA handful of spinach\n1 tsp olive oil','1 example serving','Cook the pasta according to its packet instructions. Warm the tomatoes and beans in a pan. Stir in spinach and cooked pasta.','Use a suitable pasta alternative if needed. Check ingredient labels with the client.']
    ];
    for (const r of recipes) db.prepare('INSERT OR IGNORE INTO recipes(id,title,ingredients,portions,preparation,substitutions,is_demo) VALUES(?,?,?,?,?,?,1)').run(...r);
    const exercise=(exercise_id:string,sets:number,reps:string)=>({exercise_id,sets,reps,rest_seconds:60,notes:'Example only — Alex to tailor.'});
    const training={schedule:'Example: two sessions with a rest day between. Agree the actual days with Alex.',guidance:'Starter structure for testing the builder. Alex must review exercise choice, technique, volume and progression before use.',shopping_list:'',recipe_ids:[],meals:[],workouts:[
      {name:'Full body A',day:'Monday',exercises:[exercise('starter-squat',2,'6–8'),exercise('starter-push',2,'6–8'),exercise('starter-row',2,'8 each side')]},
      {name:'Full body B',day:'Thursday',exercises:[exercise('starter-hinge',2,'8'),exercise('starter-push',2,'6–8'),exercise('starter-squat',2,'6–8')]}
    ]};
    const meal={schedule:'One example day. Add or repeat days and adjust serving notes in the builder.',guidance:'Recipe examples, not a personalised nutrition prescription. No nutrition totals or allergen-safety claims are calculated.',shopping_list:'Rolled oats\nMilk or chosen alternative\nBerries\nPlain yoghurt\nChickpeas\nRice\nCucumber\nTomatoes\nLemon\nOlive oil\nPasta\nWhite beans\nSpinach',recipe_ids:[],workouts:[],meals:[
      {day:'Monday',slot:'Breakfast',recipe_id:'starter-oats',servings:'1 example serving',notes:'Adjust to the client’s preferences.'},
      {day:'Monday',slot:'Lunch',recipe_id:'starter-chickpeas',servings:'1 example serving',notes:''},
      {day:'Monday',slot:'Dinner',recipe_id:'starter-pasta',servings:'1 example serving',notes:''}
    ]};
    for (const [id,title,kind,content] of [['starter-training','Start somewhere · sample week','training',training],['starter-meals','Good food · sample day','meal',meal]]) {
      db.prepare('INSERT OR IGNORE INTO templates(id,title,kind,content,is_demo) VALUES(?,?,?,?,1)').run(id as string,title as string,kind as string,JSON.stringify(content));
    }
    db.prepare('INSERT INTO content_packs(id) VALUES(?)').run('plan-library-v1');
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

function installExerciseContentPack(db: DatabaseSync, pack: string, exercises: ReadonlyArray<readonly [string,string,string,string,string,string]>) {
  if (db.prepare('SELECT id FROM content_packs WHERE id=?').get(pack)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert=db.prepare('INSERT INTO exercises(id,title,category,equipment,instructions,animation,is_demo) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING');
    for (const exercise of exercises) insert.run(...exercise);
    db.prepare('INSERT INTO content_packs(id) VALUES(?)').run(pack);
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

export function installStarterContent(db: DatabaseSync) {
  installPlanLibraryStarterContent(db);
  // Each marker prevents future restarts and upgrades from restoring deleted
  // entries or overwriting Alex's edits, even when another pack is introduced.
  installExerciseContentPack(db,'exercise-motions-v2',additionalStarterExercises);
  installExerciseContentPack(db,'exercise-expansion-v3',expandedStarterExercises);
}
