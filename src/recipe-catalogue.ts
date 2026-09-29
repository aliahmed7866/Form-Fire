import type { DatabaseSync } from 'node:sqlite';
import { calculateRecipe } from './nutrition.ts';

// Original, editable assembly recipes. Ingredient weights match the named
// CoFID raw/cooked/drained entry, rather than treating dry and cooked alike.
const I=(code:string,grams:number)=>({food_id:'cofid-'+code,grams});
const proteins=[['Chicken','18-323',120,'omnivore'],['Chickpea','13-670',150,'plant-based'],['Tofu','13-570',160,'plant-based'],['Lentil','13-661',160,'plant-based'],['Kidney bean','13-660',150,'plant-based'],['Salmon','16-358',120,'fish']] as const;
const bases=[['brown rice','11-869',160],['basmati','11-858',160],['couscous','11-902',160],['pasta','11-1129',160],['sweetcorn','13-529',160]] as const;
const vegetables=[['broccoli','13-504',100],['carrot','13-496',100],['tomato','13-517',100],['spinach','13-521',60]] as const;
const fruit=[['banana','14-318'],['apple','14-319'],['blueberry','14-325'],['strawberry','14-324'],['blackberry','14-388']] as const;
export function installRecipeCatalogue(db:DatabaseSync) {
  const pack='nutrition-recipes-cofid-v1';if(db.prepare('SELECT id FROM content_packs WHERE id=?').get(pack))return;
  db.exec('BEGIN IMMEDIATE');
  try {
    let count=0;
    function add(title:string,items:any[],method:string,tags:string[],minutes=20) {
      const c=calculateRecipe(items,1),recipeId=`nutrition-v1-${++count}`;
      db.prepare('INSERT OR IGNORE INTO recipes(id,title,ingredients,portions,preparation,substitutions,ingredient_items,yield_servings,nutrition,tags,prep_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(recipeId,title,c.items.map((i:any)=>`${i.grams}g · ${i.name}`).join('\n'),'1 serving',method,'Alex can duplicate this recipe, change ingredient weights and recalculate macros for your preferences. Check product labels for allergens.',JSON.stringify(c.items),1,JSON.stringify(c.nutrition),JSON.stringify(tags),minutes);
    }
    for(const [p,pc,pg,diet] of proteins)for(const [base,bc,bg] of bases)add(`${p} & ${base} rainbow bowl`,[I(pc,pg),I(bc,bg),I('13-517',100),I('13-523',80),I('17-038',5)],`Use the cooked or drained protein and cooked grain specified in the ingredients. Wash and dice the tomato and cucumber. Warm the protein and grain until piping hot if serving warm, or use freshly prepared ingredients for a cold bowl. Toss the vegetables with the measured olive oil and arrange everything in a bowl. The weights refer to edible portions in the state named in the food library.`,['lunch','dinner','bowl',diet],15);
    for(const [p,pc,pg,diet] of proteins.slice(0,5))for(const [v,vc,vg] of vegetables)add(`${p} & ${v} tomato pasta`,[I(pc,pg),I('11-1129',160),I('13-530',180),I(vc,vg),I('17-038',5)],`Wash and chop the vegetables where needed. Heat the measured olive oil in a pan, add the canned tomatoes and vegetables, then simmer until the vegetables are tender. Stir in the cooked or drained ${p.toLowerCase()} and warm through. Fold in 160g cooked pasta and heat until piping hot. Serve the entire pan as one portion.`,['dinner','pasta',diet],25);
    for(const [p,pc,pg,diet] of proteins.slice(0,5))for(const [v,vc,vg] of vegetables)add(`${p} & ${v} hearty soup`,[I(pc,pg),I(vc,vg),I('13-530',180),I('13-499',50),I('17-038',5),I('11-981',60)],`Wash and chop the vegetables and onion. Soften the onion in the measured oil, add the vegetables and tomatoes with 250ml water, and simmer until tender. Add the cooked or drained ${p.toLowerCase()} and simmer until piping hot. Serve with 60g wholemeal bread. Water does not add macronutrients; extra toppings or stock should be logged separately.`,['lunch','soup',diet],30);
    for(const [style,items,method,diet] of [
      ['overnight oats',[I('11-788',50),I('12-313',150)],'Mix the dry oats and milk with the washed or peeled fruit. Cover, refrigerate overnight, then stir before serving.','vegetarian'],
      ['yoghurt crunch',[I('12-379',180),I('14-896',15),I('11-788',25)],'Wash or peel and chop the fruit. Spoon over the yoghurt and top with oats and whole almond kernels.','vegetarian'],
      ['cottage cheese toast',[I('12-550',120),I('11-981',60)],'Toast the bread, spread with cottage cheese and add washed or peeled sliced fruit.','vegetarian'],
      ['peanut butter toast',[I('14-892',20),I('11-981',60)],'Toast the bread, spread with the measured peanut butter, and top with washed or peeled fruit.','plant-based']
    ] as const)for(const [f,fc] of fruit)add(`${f[0].toUpperCase()+f.slice(1)} ${style}`,[...items,I(fc,100)],method,['breakfast',diet],10);
    for(const [p,pc,pg,diet] of proteins.slice(0,5))for(const [v,vc,vg] of vegetables)add(`${p} & ${v} soft wrap`,[I(pc,pg),I('11-925',60),I(vc,vg),I('13-523',60),I('17-038',5)],`Wash and chop the vegetables. Use the cooked or drained ${p.toLowerCase()} specified; warm until piping hot if wanted. Warm the wheat tortilla briefly in a dry pan, add the protein, vegetables, cucumber and measured olive oil, then fold tightly. Use cooked broccoli where specified; the other listed vegetables may be served raw.`,['lunch','wrap',diet],15);
    for(const [f,fc] of fruit){add(`${f[0].toUpperCase()+f.slice(1)} & almond yoghurt pot`,[I(fc,100),I('12-379',150),I('14-896',15)],'Wash or peel the fruit, chop if needed, and spoon over the yoghurt. Add almond kernels just before eating.',['snack','vegetarian'],5);add(`${f[0].toUpperCase()+f.slice(1)} peanut butter oat bites`,[I(fc,100),I('14-892',20),I('11-788',30)],'Wash or peel the fruit. Mash or finely chop, mix with peanut butter and oats, and divide into small bites. Chill before serving. The whole batch is one logged serving.',['snack','plant-based'],10);}
    db.prepare('INSERT INTO content_packs(id) VALUES(?)').run(pack);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
