# Artwork and marks

The FORM & FIRE hero, companion still lifes, lifestyle scenes, F/flame mark and exercise-pose graphics are original illustrations created for this project. They do not depict Alex or actual clients. The lifestyle movement scene is decorative; assigned plans contain the exercise instructions.

The eight companion illustrations share sage, charcoal, bone, citrus and terracotta, with distinct compositions for equipment, food, dining, daily planning, outdoors, rest, cooking and gentle movement. The four lifestyle scenes have detail groups that animate only after Play, stop after 4.8 seconds, can be paused, and remain still with reduced motion. No health score or completion is inferred from playback.

`public/lifestyle-art.js` embeds trusted local SVGs for controlled detail animation under the app’s existing content policy. After editing the four lifestyle source SVGs, regenerate with `npm run art`. No external image service is needed for the illustrations.

`public/google-mark.svg` wraps the unchanged official Google image from [Google’s supplied G logo](https://developers.google.com/static/identity/images/g-logo.png). It is used only in the Google sign-in button, separate from the FORM & FIRE identity. Google’s mark remains Google’s property; follow its [sign-in branding guidance](https://developers.google.com/identity/branding-guidelines) when changing that button.
