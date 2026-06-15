// Building animation hotfix: restore simultaneous explode/merge with wood impact sounds.
// Loaded after app.js so it only overrides the buildingScene animation behavior.
(function () {
  const EXPLODE_LERP = 0.03;
  const MERGE_LERP = 0.028;
  const EXPLODE_SOUND_THRESHOLD = 0.88;
  const MERGE_SOUND_THRESHOLD = 0.12;
  const NORMAL_SCALE = 1.0;
  const EXPLODE_SCALE = 0.56;
  const soundKeys = new Set();

  function safeTone(freq, duration, gain, type) {
    if (typeof playTone === "function") {
      playTone(freq, duration, gain, type);
    }
  }

  function splitSound() {
    safeTone(170, 0.08, 0.05, "triangle");
    setTimeout(() => safeTone(245, 0.075, 0.044, "sine"), 64);
    safeTone(260, 0.075, 0.076, "triangle");
    setTimeout(() => safeTone(385, 0.055, 0.052, "sine"), 54);
  }

  function mergeSound() {
    safeTone(210, 0.075, 0.058, "triangle");
    setTimeout(() => safeTone(150, 0.09, 0.062, "sine"), 68);
    safeTone(118, 0.11, 0.088, "sine");
    setTimeout(() => safeTone(82, 0.12, 0.06, "triangle"), 58);
  }

  function smootherStep(t) {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  window.setBuildingExplodeTarget = function patchedSetBuildingExplodeTarget(target) {
    if (buildingExplodeTarget === target) return;
    buildingExplodeTarget = target;
    soundKeys.clear();
  };

  window.updateBuildingExplodeAnimation = function patchedUpdateBuildingExplodeAnimation() {
    if (!buildingParts || !buildingParts.length) return;

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
