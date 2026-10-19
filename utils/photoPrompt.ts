export function buildPersonaPhotoPrompt(mode: string, scene: string, request: string, hasReference: boolean, posed = false, personaName = 'the persona') {
  const subject = mode !== 'pov';
  return [
    subject ? (hasReference
      ? 'Use the supplied image as the identity reference: preserve the same face, facial structure, skin tone and hair. Do not copy its pose, background or lighting unless requested.'
      : `Depict ${personaName} realistically.`)
      : 'First-person view of the requested objects or surroundings. Do not insert the persona or use their portrait as a reference.',
    `Scene: ${scene}`,
    `User photo request: ${JSON.stringify(typeof request === 'string' ? request.slice(0, 4000) : '')}`,
    'Honor the requested subject, pose, framing, camera viewpoint, time, lighting and visual style. An explicit request overrides the defaults below; do not refuse a photoshoot or replace requested professional styling with a casual snapshot.',
    'DEFAULT ONLY when no different style is requested: an ordinary unedited phone photo someone would send in a chat. Average everyday camera quality in ordinary phone-camera auto mode, realistic skin texture, natural available light and believable unarranged surroundings. Use broad phone-camera depth of field rather than stylized portrait-mode bokeh; do not add decorative props or lettering merely to beautify the composition. Slightly imperfect framing or subtle grain/softness may fit the scene. Avoid beauty filters, plastic skin, cinematic grading and polished advertising composition. Do not force blur, clutter or faults into every image; imperfections should be plausible, not a staged effect.',
    mode === 'selfie' ? 'For an ordinary selfie, use a believable handheld phone viewpoint. For a requested mirror selfie, show the phone in the reflection with consistent mirror geometry; do not turn it into a front-camera arm-extended selfie.'
      : subject ? (posed ? 'Honor the requested pose and expression.' : 'Use a relaxed everyday moment by default; an explicit pose or photoshoot request takes priority.')
        : 'Keep framing focused on the requested scene or object.',
    'For a requested studio session, editorial, professional photoshoot or other aesthetic, use the requested lighting, sharpness, composition and finish instead of the casual-phone defaults. Keep physical details and identity believable.',
  ].join('\n');
}
