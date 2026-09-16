/* Original movement definitions. IDs remain stable in published client plans.
   Fixed support targets and angular arcs keep each demonstration controlled. */
const exerciseMotionCatalog = (() => {
  const standing = {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[163,177],[237,177]]};
  const side = {"hip":[195,177],"lean":0,"feet":[[188,273],[209,273]],"hands":[[218,165],[225,165]]};
  const pose = (base, changes={}) => ({...base,...changes});
  const entries = {
    'wall-push': {
      view: "side",
      title: "Wall press-up",
      group: "Chest",
      equipment: "Wall",
      prop: "wall",
      phases: ["Start with your arms nearly straight","Bend your elbows and bring your chest closer"],
      cue: "Keep a steady line from head to heels",
      poses: [
        {"hip":[198,183],"lean":27,"feet":[[155,273],[162,275]],"hands":[[294,124],[294,131]],"knees":[-1,-1],"elbows":[1,1]},
        {"hip":[213,191],"lean":35,"feet":[[155,273],[162,275]],"hands":[[294,124],[294,131]],"knees":[-1,-1],"elbows":[1,1]}
      ],
      duration: 5000,
    },
    'push-up': {
      view: "side",
      title: "Press-up",
      group: "Chest",
      equipment: "Mat",
      mat: true,
      prone: true,
      phases: ["Arms long, body in a line","Lower your chest with control"],
      cue: "Lower together, then press the floor away",
      poses: [
        {"hip":[224,233],"lean":-66,"feet":[[314,271],[321,273]],"hands":[[161,273],[168,275]],"elbows":[-1,-1],"knees":[-1,-1]},
        {"hip":[218,254],"lean":-78,"feet":[[314,271],[321,273]],"hands":[[161,273],[168,275]],"elbows":[-1,-1],"knees":[-1,-1]}
      ],
      duration: 5000,
    },
    'floor-press': {
      view: "side",
      title: "Dumbbell floor press",
      group: "Chest",
      equipment: "Mat · dumbbells",
      mat: true,
      weights: "both",
      phases: ["Upper arms rest near the floor","Press the weights above your chest"],
      cue: "Press above your chest; lower gently",
      poses: [
        {"hip":[190,255],"lean":-90,"feet":[[256,271],[263,273]],"hands":[[152,232],[161,234]],"elbowAngles":[60,65],"forearmAngles":[180,180],"knees":[-1,-1]},
        {"hip":[190,255],"lean":-90,"feet":[[256,271],[263,273]],"hands":[[121,181],[128,183]],"elbowAngles":[180,180],"forearmAngles":[180,180],"knees":[-1,-1]}
      ],
      duration: 5000,
    },
    'row': {
      view: "side",
      title: "Single-arm dumbbell row",
      group: "Back",
      equipment: "Dumbbell · bench",
      prop: "bench",
      weights: "near",
      phases: ["Support one hand; let the working arm hang","Pull the elbow back beside your ribs"],
      cue: "Keep the supporting hand and torso steady",
      poses: [
        {"hip":[188,183],"lean":60,"feet":[[157,273],[229,275]],"hands":[[278,206],[249,220]],"elbowAngles":[null,0],"forearmAngles":[null,0],"elbows":[-1,-1],"knees":[-1,-1]},
        {"hip":[188,183],"lean":60,"feet":[[157,273],[229,275]],"hands":[[278,206],[219,193]],"elbowAngles":[null,-75],"forearmAngles":[null,8],"elbows":[-1,-1],"knees":[-1,-1]}
      ],
      duration: 4800,
    },
    'band-row': {
      view: "side",
      title: "Standing resistance-band row",
      group: "Back",
      equipment: "Resistance band · secure anchor",
      prop: "band",
      phases: ["Start with your arms reaching forwards","Pull your elbows back beside you"],
      cue: "Draw elbows back; avoid leaning away",
      poses: [
        {"hip":[177,176],"lean":0,"feet":[[165,273],[179,275]],"hands":[[242,120],[249,122]],"elbows":[1,1]},
        {"hip":[177,176],"lean":0,"feet":[[165,273],[179,275]],"hands":[[195,141],[202,143]],"elbows":[1,1]}
      ],
      duration: 4800,
    },
    'reverse-fly': {
      view: "front",
      title: "Bent-over reverse fly",
      group: "Back",
      equipment: "Light dumbbells",
      weights: "both",
      phases: ["Hold a hip hinge with arms below your chest","Open your arms outwards, with soft elbows"],
      cue: "Keep the hinge still as the arms open",
      poses: [
        {"hip":[200,176],"lean":0,"feet":[[169,273],[231,273]],"hands":[[163,177],[237,177]],"torso":46,"elbowAngles":[-8,8],"forearmAngles":[-12,12]},
        {"hip":[200,176],"lean":0,"feet":[[169,273],[231,273]],"hands":[[163,177],[237,177]],"torso":46,"elbowAngles":[-86,86],"forearmAngles":[-70,70]}
      ],
      viewLabel: "Front · hip hinge",
      duration: 5000,
    },
    'shoulder-press': {
      view: "front",
      title: "Dumbbell shoulder press",
      group: "Shoulders",
      equipment: "Dumbbells",
      weights: "both",
      phases: ["Weights beside your shoulders","Press upwards with control"],
      cue: "Press tall with a comfortable overhead reach",
      poses: [
        {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[163,177],[237,177]],"elbowAngles":[-52,52],"forearmAngles":[-177,177]},
        {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[163,177],[237,177]],"elbowAngles":[-165,165],"forearmAngles":[-175,175]}
      ],
      duration: 4800,
    },
    'lateral-raise': {
      view: "front",
      title: "Dumbbell lateral raise",
      group: "Shoulders",
      equipment: "Light dumbbells",
      weights: "both",
      phases: ["Arms relaxed by your sides","Lift out towards shoulder height"],
      cue: "Soft elbows; stop around shoulder height",
      poses: [
        {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[163,177],[237,177]],"elbowAngles":[-6,6],"forearmAngles":[-10,10]},
        {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[163,177],[237,177]],"elbowAngles":[-86,86],"forearmAngles":[-75,75]}
      ],
      duration: 4800,
    },
    'biceps-curl': {
      view: "side",
      title: "Dumbbell biceps curl",
      group: "Biceps",
      equipment: "Dumbbells",
      weights: "both",
      phases: ["Start with your arms long","Curl towards your shoulders"],
      cue: "Keep upper arms still; lower with control",
      poses: [
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[4,4]},
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[155,155]}
      ],
      duration: 4800,
    },
    'hammer-curl': {
      view: "side",
      title: "Dumbbell hammer curl",
      group: "Biceps",
      equipment: "Dumbbells",
      weights: "both",
      grip: "hammer",
      phases: ["Palms face towards one another","Curl with a neutral grip"],
      cue: "Neutral grip; elbows stay beside your ribs",
      poses: [
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[4,4]},
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[150,150]}
      ],
      duration: 4800,
    },
    'triceps-extension': {
      view: "side",
      title: "Overhead triceps extension",
      group: "Triceps",
      equipment: "One dumbbell",
      weights: "near",
      phases: ["Bend your elbows behind your head","Straighten your arms upwards"],
      cue: "Keep upper arms steady beside your head",
      poses: [
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[174,174],"forearmAngles":[-55,-55]},
        {"hip":[195,176],"lean":0,"feet":[[197,273],[204,275]],"hands":[[218,165],[225,165]],"elbowAngles":[174,174],"forearmAngles":[-186,-186]}
      ],
      duration: 5000,
    },
    'triceps-kickback': {
      view: "side",
      title: "Supported triceps kickback",
      group: "Triceps",
      equipment: "One dumbbell · bench",
      prop: "bench",
      weights: "near",
      phases: ["Support one hand and bend the working elbow","Straighten the working arm behind you"],
      cue: "Keep the elbow still as the forearm moves",
      poses: [
        {"hip":[188,190],"lean":56,"feet":[[154,273],[222,275]],"hands":[[278,206],[213,202]],"elbowAngles":[null,-70],"forearmAngles":[null,0],"elbows":[-1,-1],"knees":[-1,-1]},
        {"hip":[188,190],"lean":56,"feet":[[154,273],[222,275]],"hands":[[278,206],[180,176]],"elbowAngles":[null,-70],"forearmAngles":[null,-70],"elbows":[-1,-1],"knees":[-1,-1]}
      ],
      duration: 4800,
    },
    'dead-bug': {
      view: "side",
      title: "Dead bug",
      group: "Core",
      equipment: "Mat",
      mat: true,
      phases: ["Arms up, knees over your hips","Reach one arm and the opposite leg"],
      cue: "Keep your back steady; switch sides after each rep",
      poses: [
        {"hip":[203,258],"lean":-90,"feet":[[250,203],[257,205]],"hands":[[134,184],[141,186]],"elbowAngles":[180,180],"forearmAngles":[180,180],"upperLegAngles":[180,180],"lowerLegAngles":[90,90]},
        {"hip":[203,258],"lean":-90,"feet":[[301,244],[257,205]],"hands":[[134,184],[77,227]],"elbowAngles":[180,245],"forearmAngles":[180,245],"upperLegAngles":[96,180],"lowerLegAngles":[96,90]}
      ],
      duration: 5600,
    },
    'bird-dog': {
      view: "side",
      title: "Bird dog",
      group: "Core",
      equipment: "Mat",
      mat: true,
      prone: true,
      phases: ["Start on your hands and knees","Reach the opposite arm and leg"],
      cue: "Reach long while keeping your hips level",
      poses: [
        {"hip":[215,219],"lean":-77,"feet":[[262,268],[269,270]],"hands":[[148,272],[157,273]],"elbowAngles":[0,null],"forearmAngles":[0,null],"upperLegAngles":[0,0],"lowerLegAngles":[90,90],"elbows":[1,1]},
        {"hip":[215,219],"lean":-77,"feet":[[262,268],[320,232]],"hands":[[79,185],[157,273]],"elbowAngles":[-103,null],"forearmAngles":[-103,null],"upperLegAngles":[0,82],"lowerLegAngles":[90,82],"elbows":[1,1]}
      ],
      duration: 5600,
    },
    'plank': {
      view: "side",
      title: "Forearm plank",
      group: "Core",
      equipment: "Mat",
      mat: true,
      prone: true,
      hold: true,
      phases: ["Find a steady forearm hold","Keep breathing comfortably"],
      cue: "A steady body line; keep breathing naturally",
      poses: [
        {"hip":[220,249],"lean":-76,"feet":[[314,273],[321,275]],"hands":[[118,269],[125,271]],"knees":[-1,-1],"elbowAngles":[0,0],"forearmAngles":[-90,-90]},
        {"hip":[220,249],"lean":-76,"feet":[[314,273],[321,275]],"hands":[[118,269],[125,271]],"knees":[-1,-1],"elbowAngles":[0,0],"forearmAngles":[-90,-90]}
      ],
      duration: 5600,
    },
    'glute-bridge': {
      view: "side",
      title: "Glute bridge",
      group: "Glutes",
      equipment: "Mat",
      mat: true,
      phases: ["Lie back with feet comfortably close","Lift until your shoulders, hips and knees align"],
      cue: "Lift smoothly without arching your back",
      poses: [
        {"hip":[196,255],"lean":-90,"headAngle":-90,"shoulderAnchor":[130,255],"feet":[[243,271],[250,273]],"hands":[[166,271],[176,268]],"knees":[-1,-1],"elbowAngles":[80,80],"forearmAngles":[90,90]},
        {"hip":[193,235],"lean":-108,"headAngle":-90,"shoulderAnchor":[130,255],"feet":[[243,271],[250,273]],"hands":[[166,271],[176,268]],"knees":[-1,-1],"elbowAngles":[80,80],"forearmAngles":[90,90]}
      ],
      duration: 5200,
    },
    // Shortened leg lengths represent foreshortening in this side-lying projection.
    'clamshell': {
      view: "side",
      title: "Side-lying clamshell",
      group: "Glutes",
      equipment: "Mat",
      mat: true,
      phases: ["Lie on your side, knees gently bent","Open the top knee, feet stay together"],
      cue: "Feet together; open without rolling your hips",
      poses: [
        {"hip":[206,247],"lean":-92,"headAngle":-90,"feet":[[267,259],[274,261]],"hands":[[108,239],[166,264]],"knees":[1,1],"elbows":[-1,-1],"elbowAngles":[-42,null],"forearmAngles":[-170,null],"topKneeOpen":0},
        {"hip":[206,247],"lean":-92,"headAngle":-90,"feet":[[267,259],[274,261]],"hands":[[108,239],[166,264]],"knees":[1,1],"elbows":[-1,-1],"elbowAngles":[-42,null],"forearmAngles":[-170,null],"topKneeOpen":1}
      ],
      legLengths: [40,38],
      duration: 5200,
    },
    'standing-hip-abduction': {
      view: "front",
      title: "Standing hip abduction",
      group: "Glutes",
      equipment: "Chair or stable support",
      prop: "balance-chair",
      phases: ["Stand tall beside your support","Lift the outside leg gently sideways"],
      cue: "A small side lift; keep your pelvis level",
      poses: [
        {"hip":[200,173],"lean":0,"feet":[[170,273],[230,273]],"hands":[[127,143],[238,161]]},
        {"hip":[200,173],"lean":0,"feet":[[170,273],[270,256]],"hands":[[127,143],[238,161]]}
      ],
      duration: 5000,
    },
    'squat': {
      view: "side",
      title: "Chair sit-to-stand",
      group: "Legs",
      equipment: "Sturdy chair",
      prop: "chair",
      phases: ["Sit near the front with feet under your knees","Press through both feet and stand tall"],
      cue: "Keep your feet planted; sit back with control",
      poses: [
        {"hip":[169,222],"lean":24,"feet":[[222,273],[229,275]],"hands":[[218,165],[225,165]],"elbowAngles":[70,70],"forearmAngles":[90,90],"knees":[-1,-1]},
        {"hip":[220,176],"lean":0,"feet":[[222,273],[229,275]],"hands":[[218,165],[225,165]],"elbowAngles":[70,70],"forearmAngles":[90,90],"knees":[-1,-1]}
      ],
      duration: 5400,
    },
    'reverse-lunge': {
      view: "side",
      title: "Reverse lunge",
      group: "Legs",
      equipment: "Bodyweight",
      phases: ["Begin in a comfortable standing stance","Step back and bend both knees"],
      cue: "Front foot stays planted; step back with control",
      poses: [
        {"hip":[246,176],"lean":0,"feet":[[250,273],[257,275]],"hands":[[260,152],[267,154]],"knees":[-1,-1],"heelSides":[0,0]},
        {"hip":[206,216],"lean":5,"feet":[[168,260],[257,275]],"hands":[[225,189],[232,191]],"knees":[-1,-1],"heelSides":[0.8,0]}
      ],
      duration: 5600,
    },
    'hinge': {
      view: "side",
      title: "Bodyweight hip hinge",
      group: "Legs",
      equipment: "Bodyweight",
      phases: ["Stand tall with soft knees","Send your hips back as you fold"],
      cue: "Soft knees; send your hips gently backwards",
      poses: [
        {"hip":[205,176],"lean":0,"feet":[[208,273],[215,275]],"hands":[[210,172],[218,174]],"knees":[-1,-1],"elbows":[-1,-1]},
        {"hip":[184,178],"lean":55,"feet":[[208,273],[215,275]],"hands":[[190,179],[198,181]],"knees":[-1,-1],"elbows":[-1,-1]}
      ],
      duration: 5200,
    },
    'romanian-deadlift': {
      view: "side",
      title: "Dumbbell Romanian deadlift",
      group: "Legs",
      equipment: "Dumbbells",
      weights: "both",
      phases: ["Stand tall, weights close to your legs","Hinge back, lowering the weights"],
      cue: "Hinge at the hips; let your arms hang long",
      poses: [
        {"hip":[205,176],"lean":0,"feet":[[208,273],[215,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[0,0],"knees":[-1,-1]},
        {"hip":[184,178],"lean":55,"feet":[[208,273],[215,275]],"hands":[[218,165],[225,165]],"elbowAngles":[0,0],"forearmAngles":[0,0],"knees":[-1,-1]}
      ],
      duration: 5200,
    },
    'calf-raise': {
      view: "front",
      title: "Standing calf raise",
      group: "Calves",
      equipment: "Chair or stable support",
      prop: "balance-chair",
      phases: ["Heels rest on the floor","Rise onto the balls of your feet"],
      cue: "Rise smoothly; keep the balls of your feet down",
      poses: [
        {"hip":[200,172],"lean":0,"feet":[[178,273],[222,273]],"hands":[[127,143],[238,164]],"heels":0},
        {"hip":[200,160],"lean":0,"feet":[[178,273],[222,273]],"hands":[[127,143],[238,152]],"heels":0.72}
      ],
      toePivot: [true,true],
      duration: 5000,
    },
    'seated-calf-raise': {
      view: "side",
      title: "Seated calf raise",
      group: "Calves",
      equipment: "Sturdy chair",
      prop: "chair",
      phases: ["Sit tall with feet flat","Lift your heels, toes stay down"],
      cue: "Lift the heels; keep your toes in place",
      poses: [
        {"hip":[169,222],"lean":6,"feet":[[222,273],[229,275]],"hands":[[206,214],[213,216]],"knees":[-1,-1],"heels":0},
        {"hip":[169,222],"lean":6,"feet":[[222,273],[229,275]],"hands":[[206,205],[213,207]],"knees":[-1,-1],"heels":0.65}
      ],
      toePivot: [true,true],
      duration: 5000,
    },
  };
  return Object.freeze(Object.fromEntries(Object.entries({...entries,...extraExerciseMotions({pose,standing,side})}).map(([key,entry],index)=>[key,Object.freeze({key,view:'front',duration:4400,variant:index%6,...entry})])));
})();
