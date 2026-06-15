// Building animation hotfix: simultaneous explode/merge with louder wood impact sounds.
// Loaded after app.js so it only overrides the buildingScene animation behavior.
(function () {
  const EXPLODE_LERP = 0.03;
  const MERGE_LERP = 0.028;
  const EXPLODE_SOUND_THRESHOLD = 0.86;
  const MERGE_SOUND_THRESHOLD = 0.14;
  const NORMAL_SCALE = 1.0;
  const EXPLODE_SCALE = 0.56;
  const soundKeys = new Set();
  let patchAudioCtx = null;
  let lastObservedTarget = null;

  function unlockPatchAudio() {
    try {
      if (!patchAudioCtx) {
        patchAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (patchAudioCtx.state === "suspended") patchAudioCtx.resume();
      if (typeof ensureAudioContext === "function") ensureAudioContext();
    } catch (err) {}
  }

  document.addEventListener("pointerdown", unlockPatchAudio, { passive: true });
  document.addEventListener("touchstart", unlockPatchAudio, { passive: true });
  document.addEventListener("keydown", unlockPatchAudio);

  function fallbackTone(freq, duration, gain, type) {
    try {
      unlockPatchAudio();
      if (!patchAudioCtx) return;
      const osc = patchAudioCtx.createOscillator();
      const amp = patchAudioCtx.createGain();
      osc.type = type || "triangle";
      osc.frequency.setValueAtTime(freq, patchAudioCtx.currentTime);
      amp.gain.setValueAtTime(0.0001, patchAudioCtx.currentTime);
      amp.gain.exponentialRampToValueAtTime(gain, patchAudioCtx.currentTime + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, patchAudioCtx.currentTime + duration);
      osc.connect(amp);
      amp.connect(patchAudioCtx.destination);
      osc.start();
      osc.stop(patchAudioCtx.currentTime + duration + 0.02);
    } catch (err) {}
  }

  function safeTone(freq, duration, gain, type) {
    unlockPatchAudio();
    if (typeof playTone === "function") {
      playTone(freq, duration, Math.min(gain, 0.11), type);
    }
    fallbackTone(freq, duration, gain, type);
  }

  function splitSound() {
    safeTone(155, 0.10, 0.11, "triangle");
    setTimeout(() => safeTone(235, 0.09, 0.095, "sine"), 55);
    setTimeout(() => safeTone(330, 0.07, 0.075, "triangle"), 115);
  }

  function mergeSound() {
    safeTone(185, 0.10, 0.12, "triangle");
    setTimeout(() => safeTone(120, 0.13, 0.13, "sine"), 62);
    setTimeout(() => safeTone(76, 0.15, 0.095, "triangle"), 125);
  }

  function smootherStep(t) {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function resetSoundKeysIfTargetChanged() {
    if (lastObservedTarget !== buildingExplodeTarget) {
      lastObservedTarget = buildingExplodeTarget;
      soundKeys.clear();
    }
  }

  window.setBuildingExplodeTarget = function patchedSetBuildingExplodeTarget(target) {
    if (buildingExplodeTarget === target) return;
    buildingExplodeTarget = target;
    lastObservedTarget = target;
    soundKeys.clear();
  };

  window.updateBuildingExplodeAnimation = function patchedUpdateBuildingExplodeAnimation() {
    if (!buildingParts || !buildingParts.length) return;
    resetSoundKeysIfTargetChanged();

    buildingExplodeProgress = THREE.MathUtils.lerp(
      buildingExplodeProgress,
      buildingExplodeTarget,
      buildingExplodeTarget === 1 ? EXPLODE_LERP : MERGE_LERP
    );

    const eased = smootherStep(buildingExplodeProgress);
    const transformT = THREE.MathUtils.clamp(eased, 0, 1);

    buildingParts.forEach((part) => {
      part.object.position.lerpVectors(part.originalPosition, part.explodePosition, eased);
      part.object.quaternion.slerpQuaternions(part.originalQuaternion, part.explodeQuaternion, transformT);
      part.object.scale.lerpVectors(part.originalScale, part.explodeScale, transformT);
    });

    if (buildingExplodeTarget === 1 && buildingExplodeProgress >= EXPLODE_SOUND_THRESHOLD && !soundKeys.has("split")) {
      soundKeys.add("split");
      splitSound();
    }

    if (buildingExplodeTarget === 0 && buildingExplodeProgress <= MERGE_SOUND_THRESHOLD && !soundKeys.has("merge")) {
      soundKeys.add("merge");
      mergeSound();
    }

    if (buildingPartsGroup) {
      const targetScale = THREE.MathUtils.lerp(NORMAL_SCALE, EXPLODE_SCALE, eased);
      buildingPartsGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
    }

    if (typeof updateBuildingModelVisibility === "function") {
      updateBuildingModelVisibility();
    }
  };
})();
