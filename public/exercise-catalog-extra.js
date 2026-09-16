/* Original FORM & FIRE additions. Props and joint targets share the 400 × 320 stage.
   Angle-based movements keep the working elbow or knee steady throughout the rep. */
function extraExerciseMotions({pose,standing,side}) {
  return {
    'incline-push-up': {
      title:'Incline press-up',group:'Chest',equipment:'Stable raised support',view:'side',prop:'incline-support',
      phases:['Start in a long line, hands on the support','Bend your elbows and bring your chest closer'],
      cue:'Move your chest and hips together',
      poses:[
        pose(side,{hip:[211,181],lean:22.5,feet:[[169,272],[176,274]],hands:[[278,172],[285,174]],elbows:[1,1],knees:[1,1]}),
        pose(side,{hip:[235,196],lean:38.6,feet:[[169,272],[176,274]],hands:[[278,172],[285,174]],elbows:[1,1],knees:[1,1]})
      ]
    },
    'bench-press': {
      title:'Dumbbell bench press',group:'Chest',equipment:'Dumbbells · flat bench',view:'side',prop:'weight-bench',weights:'both',
      phases:['Lie supported, weights beside your chest','Press the weights above your chest'],
      cue:'Lower smoothly; keep your feet planted',
      poses:[
        {hip:[197,218],lean:-90,headAngle:-90,feet:[[259,273],[270,273]],knees:[-1,-1],elbowAngles:[-66,66],forearmAngles:[-178,178]},
        {hip:[197,218],lean:-90,headAngle:-90,feet:[[259,273],[270,273]],knees:[-1,-1],elbowAngles:[-177,177],forearmAngles:[-177,177]}
      ]
    },
    'lat-pulldown': {
      title:'Lat pulldown',group:'Back',equipment:'Cable pulldown machine',prop:'pulldown',
      phases:['Sit tall and reach for the bar','Draw the bar towards your upper chest'],
      cue:'Pull elbows down; keep your torso steady',
      poses:[
        pose(standing,{hip:[200,220],feet:[[154,273],[246,273]],hands:[[148,92],[252,92]],elbows:[-1,1]}),
        pose(standing,{hip:[200,220],feet:[[154,273],[246,273]],hands:[[153,162],[247,162]],elbows:[-1,1]})
      ]
    },
    'front-raise': {
      title:'Single-arm front raise',group:'Shoulders',equipment:'One light dumbbell',view:'side',weights:'near',duration:4800,
      phases:['Stand tall with the weight beside your thigh','Raise the weight forwards to shoulder height'],
      cue:'A soft elbow; then switch sides',
      poses:[
        pose(side,{elbowAngles:[-5,5],forearmAngles:[-5,5]}),
        pose(side,{elbowAngles:[-5,90],forearmAngles:[-5,90]})
      ]
    },
    'concentration-curl': {
      title:'Seated concentration curl',group:'Biceps',equipment:'One dumbbell · sturdy seat',view:'side',prop:'curl-seat',weights:'near',duration:4800,
      phases:['Brace your upper arm against your inner thigh','Curl the weight while your elbow stays still'],
      cue:'Keep the upper arm supported; switch sides',
      poses:[
        pose(side,{hip:[183,222],lean:50,feet:[[148,273],[258,273]],hands:[[208,217],[236,249]],knees:[1,-1],elbows:[1,-1],elbowAngles:[null,-15],forearmAngles:[null,12]}),
        pose(side,{hip:[183,222],lean:50,feet:[[148,273],[258,273]],hands:[[208,217],[238,180]],knees:[1,-1],elbows:[1,-1],elbowAngles:[null,-15],forearmAngles:[null,165]})
      ]
    },
    'lying-triceps-extension': {
      title:'Lying dumbbell triceps extension',group:'Triceps',equipment:'Mat · dumbbells',view:'side',mat:true,weights:'both',duration:4800,
      phases:['Lie back, bend your elbows with the weights above your head','Straighten your elbows above your shoulders'],
      cue:'Keep your upper arms pointing upwards',
      poses:[
        {hip:[190,255],lean:-90,feet:[[267,273],[278,273]],knees:[-1,-1],elbowAngles:[190,170],forearmAngles:[-115,-110]},
        {hip:[190,255],lean:-90,feet:[[267,273],[278,273]],knees:[-1,-1],elbowAngles:[190,170],forearmAngles:[-170,-190]}
      ]
    },
    'side-plank': {
      title:'Side plank',group:'Core',equipment:'Mat',view:'side',faceFront:true,mat:true,hold:true,
      phases:['Stack your hips and support yourself on one forearm','Keep the hold steady and breathe comfortably'],
      cue:'A steady hold; then change sides',
      poses:[
        {hip:[220,252],lean:-74,feet:[[316,273],[323,275]],knees:[-1,-1],elbowAngles:[180,0],forearmAngles:[180,-90]},
        {hip:[220,252],lean:-74,feet:[[316,273],[323,275]],knees:[-1,-1],elbowAngles:[180,0],forearmAngles:[180,-90]}
      ]
    },
    'mountain-climber': {
      title:'Slow mountain climber',group:'Core',equipment:'Mat',view:'side',mat:true,prone:true,duration:4800,
      phases:['Start in a high plank with your arms long','Bring one knee forwards beneath your body'],
      cue:'Keep your shoulders steady; switch legs',
      poses:[
        {hip:[220,229],lean:-70,feet:[[305,273],[315,273]],hands:[[156,273],[163,273]],knees:[-1,1],elbows:[-1,-1],upperLegAngles:[null,60],lowerLegAngles:[null,68]},
        // A small pelvis lift makes room for the knee; the planted hand/foot targets stay fixed.
        {hip:[236,208],lean:-89,feet:[[305,273],[275,260]],hands:[[156,273],[163,273]],knees:[-1,1],elbows:[-1,-1],upperLegAngles:[null,-17],lowerLegAngles:[null,86]},
        {hip:[224,219],lean:-79,feet:[[305,273],[215,261]],hands:[[156,273],[163,273]],knees:[-1,1],elbows:[-1,-1],upperLegAngles:[null,-78],lowerLegAngles:[null,50]}
      ]
    },
    'bodyweight-squat': {
      title:'Bodyweight squat',group:'Legs',equipment:'Bodyweight',view:'side',
      phases:['Stand comfortably and reach your arms forwards','Bend your knees and sit down between your hips'],
      cue:'Press through both feet to stand',
      poses:[
        pose(side,{hip:[211,176],lean:0,feet:[[208,273],[222,273]],knees:[-1,-1],elbowAngles:[80,80],forearmAngles:[80,80]}),
        pose(side,{hip:[183,219],lean:30,feet:[[208,273],[222,273]],knees:[-1,-1],elbowAngles:[80,80],forearmAngles:[80,80]})
      ]
    },
    'goblet-squat': {
      title:'Dumbbell goblet squat',group:'Legs',equipment:'One dumbbell',view:'side',weights:'centre',grip:'hammer',
      phases:['Hold one dumbbell close to your chest','Lower into your squat, keeping the weight close'],
      cue:'Keep the weight close as you stand',
      poses:[
        pose(side,{hip:[211,176],lean:0,feet:[[208,273],[222,273]],hands:[[232,134],[239,136]],knees:[-1,-1],elbows:[1,1]}),
        pose(side,{hip:[183,219],lean:30,feet:[[208,273],[222,273]],hands:[[237,186],[244,188]],knees:[-1,-1],elbows:[1,1]})
      ]
    },
    'split-squat': {
      title:'Static split squat',group:'Legs',equipment:'Bodyweight',view:'side',toePivot:[true,false],
      phases:['Set a split stance with your rear heel raised','Bend both knees and lower straight down'],
      cue:'Keep your stance; then switch sides',
      poses:[
        pose(side,{hip:[216,183],lean:0,feet:[[156,273],[266,273]],hands:[[229,176],[236,177]],knees:[-1,-1],heelSides:[1,0]}),
        pose(side,{hip:[216,218],lean:4,feet:[[156,273],[266,273]],hands:[[229,212],[236,213]],knees:[-1,-1],heelSides:[1,0]})
      ]
    },
    'step-up': {
      title:'Low step-up',group:'Legs',equipment:'Stable low step',view:'side',prop:'low-step',footArc:[0,48],duration:5200,
      phases:['Place your whole leading foot on the step','Press through that foot and step up tall'],
      cue:'Step up with control; then switch sides',
      poses:[
        pose(side,{hip:[204,181],lean:10,feet:[[259,235],[205,273]],hands:[[218,167],[228,170]],knees:[-1,-1]}),
        pose(side,{hip:[251,137],lean:0,feet:[[259,235],[274,235]],hands:[[270,126],[279,129]],knees:[-1,-1]})
      ]
    },
    'standing-leg-curl': {
      title:'Standing leg curl',group:'Legs',equipment:'Chair or stable support',view:'side',prop:'right-chair',
      phases:['Stand tall and hold your support','Bend one knee and bring that heel behind you'],
      cue:'Keep your thighs still; then switch sides',
      poses:[
        pose(side,{hip:[210,174],hands:[[261,144],[268,147]],upperLegAngles:[-2,5],lowerLegAngles:[-2,5],shoeAngles:[0,0]}),
        pose(side,{hip:[210,174],hands:[[261,144],[268,147]],upperLegAngles:[-2,5],lowerLegAngles:[-2,-90],shoeAngles:[0,90]})
      ]
    },
    'donkey-kick': {
      title:'Bent-knee donkey kick',group:'Glutes',equipment:'Mat',view:'side',mat:true,prone:true,
      phases:['Start on your hands and knees','Lift one bent leg behind you to hip height'],
      cue:'Keep your hips level; then switch sides',
      poses:[
        {hip:[215,215],lean:-84,hands:[[147,273],[155,273]],elbows:[-1,-1],upperLegAngles:[0,0],lowerLegAngles:[90,90],shoeAngles:[0,0]},
        {hip:[215,215],lean:-84,hands:[[147,273],[155,273]],elbows:[-1,-1],upperLegAngles:[0,95],lowerLegAngles:[90,185],shoeAngles:[0,180]}
      ]
    },
    'sumo-squat': {
      title:'Dumbbell sumo squat',group:'Glutes',equipment:'One dumbbell',weights:'centre',grip:'hammer',
      phases:['Take a wide stance and hold the weight between your legs','Lower between your hips with your knees following your toes'],
      cue:'Knees follow your toes; press evenly',
      poses:[
        pose(standing,{hip:[200,188],feet:[[137,273],[263,273]],hands:[[194,186],[206,186]]}),
        pose(standing,{hip:[200,226],feet:[[137,273],[263,273]],hands:[[194,224],[206,224]]})
      ]
    },
    'single-leg-calf-raise': {
      title:'Supported single-leg calf raise',group:'Calves',equipment:'Chair or stable support',view:'side',prop:'right-chair',toePivot:[false,true],
      phases:['Balance on one foot with your heel down','Rise through that foot, keeping the toes planted'],
      cue:'Lift smoothly; then switch sides',
      poses:[
        pose(side,{hip:[216,174],feet:[[183,241],[220,273]],hands:[[266,143],[273,145]],knees:[-1,-1],heelSides:[0,0]}),
        pose(side,{hip:[230,160],feet:[[197,227],[220,273]],hands:[[266,143],[273,145]],knees:[-1,-1],heelSides:[0,1]})
      ]
    }
  };
}

/* Fixed, trusted SVG only: these props never interpolate user-authored markup. */
function extraExerciseEquipment(entry,g) {
  if(entry.prop==='incline-support')return '<path d="M269 183h71" fill="none" stroke="#28372b" stroke-width="16" stroke-linecap="round"/><path d="M277 192v86m54-86v86M277 245h54" fill="none" stroke="#748264" stroke-width="7" stroke-linecap="round"/><path d="M271 177h67" stroke="#d4e575" stroke-width="4" stroke-linecap="round"/>';
  if(entry.prop==='weight-bench')return '<path d="M77 237h150" fill="none" stroke="#28372b" stroke-width="17" stroke-linecap="round"/><path d="M91 246l-7 32m127-32 8 32" fill="none" stroke="#748264" stroke-width="8" stroke-linecap="round"/><path d="M78 230h148" stroke="#d4e575" stroke-width="4" stroke-linecap="round"/>';
  if(entry.prop==='pulldown')return '<path d="M118 277V61h164v216M118 61h-8m172 0h8" fill="none" stroke="#748264" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M174 237h52M182 241v35m36-35v35" fill="none" stroke="#28372b" stroke-width="10" stroke-linecap="round"/><path d="M160 215h80" stroke="#748264" stroke-width="12" stroke-linecap="round"/><circle cx="144" cy="64" r="7" fill="#d4e575" stroke="#28372b" stroke-width="2"/><circle cx="256" cy="64" r="7" fill="#d4e575" stroke="#28372b" stroke-width="2"/>';
  if(entry.prop==='curl-seat')return '<path d="M161 237h51" fill="none" stroke="#28372b" stroke-width="13" stroke-linecap="round"/><path d="M170 245l-6 32m39-32 6 32" fill="none" stroke="#748264" stroke-width="7" stroke-linecap="round"/><path d="M163 232h47" stroke="#d4e575" stroke-width="3" stroke-linecap="round"/>';
  if(entry.prop==='low-step')return '<path d="M244 246h83v36h-83z" fill="#748264" stroke="#28372b" stroke-width="2" stroke-linejoin="round"/><path d="M242 245h87" stroke="#28372b" stroke-width="6" stroke-linecap="round"/><path d="M253 253h65" stroke="#d4e575" stroke-width="3" stroke-linecap="round"/><path d="M252 279v-11m67 11v-11" stroke="#28372b" stroke-width="4" stroke-linecap="round"/>';
  if(entry.prop==='right-chair')return '<g fill="none" stroke="#748264" stroke-width="6" stroke-linecap="round"><path d="M266 143h37v89h-37M266 143v89M272 232v43m27-43v43"/></g><path d="M267 229h36" stroke="#d4e575" stroke-width="8"/>';
  return '';
}

function extraExerciseForeground(entry,g) {
  if(entry.prop!=='pulldown')return '';
  const a=g.arms[0].end,b=g.arms[1].end;
  const round=value=>Math.round(value*100)/100;
  const ax=round(a[0]),ay=round(a[1]),bx=round(b[0]),by=round(b[1]);
  return `<path d="M144 71L${ax} ${ay}M256 71L${bx} ${by}" fill="none" stroke="#8b7555" stroke-width="2.5"/><path d="M${ax-13} ${ay+4}L${ax} ${ay}L${bx} ${by}L${bx+13} ${by+4}" fill="none" stroke="#28372b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M${ax-11} ${ay+3}L${ax+3} ${ay}M${bx-3} ${by}L${bx+11} ${by+3}" fill="none" stroke="#d4e575" stroke-width="8" stroke-linecap="round"/>`;
}
