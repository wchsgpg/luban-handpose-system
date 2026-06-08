// v17: target ghost + depth control + locked final result.
// Main changes:
// 1) Camera direction: cursor follows the mirrored camera preview by default.
// 2) Hand depth: when the hand is closer to the camera, the grabbed block moves deeper into the scene.
// 3) Target ghost: final arrangement is shown in white transparent material.
// 4) Correct placement result: when a block is close enough to its target, it snaps, locks, and can no longer be moved.
// 5) Naming support:
//    Active pieces: models/luban_lock/luban_a.glb ... luban_f.glb
//    Target reference: models/luban_target/target_full.glb OR target_a.glb ... target_f.glb

let scene, camera, renderer, loader;
let lubanGroup;
let targetGroup;
let pieces = [];
let ghostTargets = [];
let stepModels = [];
let currentStepIndex = 0;
const STEP_ORDER = ["luban_a", "luban_b", "luban_c", "luban_d", "luban_e", "luban_f"];
let selected = null;
let autoAssembly = false;
let progressSmooth = 0;
let gameComplete = false;
let finalDisplayActive = false;

let handPose;
let video;
let hands = [];
let handPoseStarted = false;
let handPoseDetectStarted = false;
let handPoseP5DetectStarted = false;
let handPoseNativeDetectStarted = false;
let handPosePollActive = false;
let lastHandPosePollTime = 0;
let lastHandsSeenTime = 0;

// The camera preview is mirrored, and the cursor uses the same mirrored direction.
// If the user's computer behaves differently, use the "좌우 반전" button.
let mirrorInteraction = true;

let cursor = {
  visible: false,
  x: 0.5,
  y: 0.5,
  rawX: 0.5,
  rawY: 0.5,
  fist: false,
  gesture: "inactive",
  previousX: 0.5,
  previousY: 0.5,
  handAngle: 0,
  depthZ: 0.15,
  targetDepthZ: 0.15,
  handSpan: 0,
};

let raycaster;
let dragPlane;
let dragOffset = new THREE.Vector3();
let selectedBaseRot = null;
let audioCtx = null;
let lastMagnetKey = null;
let lastCursorVisible = false;
let musicEnabled = true;
let musicResumeListenerAttached = false;
let viewerScene = null;
let viewerCamera = null;
let viewerRenderer = null;
let viewerGroup = null;
let viewerModel = null;
let currentViewerModelKey = "luban_a";
let viewerAnimationActive = false;
let viewerInitialized = false;
let viewerLoading = false;
let viewerLoadToken = 0;
let currentScreen = "cover";
let buildingInitialized = false;
let buildingThreeScene = null;
let buildingCamera = null;
let buildingRenderer = null;
let buildingGroup = null;
let buildingLoader = null;
let buildingRaycaster = null;
let fullBuildingGroup = null;
let buildingPartsGroup = null;
let buildingFullModel = null;
let buildingParts = [];
let buildingExplodeTargets = new Map();
let buildingExplodeProgress = 0;
let buildingExplodeTarget = 0;
let buildingPartsLoaded = 0;
let buildingExplodeTargetsLoaded = 0;
let buildingFullLoaded = false;
let buildingCentered = false;
let buildingHoverTarget = null;
let buildingHoverStartTime = 0;
let buildingCursorState = { visible: false, x: 0.5, y: 0.5, clientX: 0, clientY: 0 };
let buildingPartViewerActive = false;
let buildingPartViewerScene = null;
let buildingPartViewerCamera = null;
let buildingPartViewerRenderer = null;
let buildingPartViewerGroup = null;
let buildingPartViewerModel = null;
let buildingPartViewerInitialized = false;
let buildingPartViewerLoadToken = 0;
let returnHoverStartTime = 0;
let buildingBaseScale = 1;
let buildingCameraCanvas = null;
let buildingCameraCtx = null;
let gameCameraCanvas = null;
let gameCameraCtx = null;
let currentLang = "ko";
let coverCursorState = { visible: false, x: 0.5, y: 0.5, clientX: 0, clientY: 0 };
let coverEnterHoverStart = 0;
let lubanEntryHoverStart = 0;
let lubanButtonHoverTarget = null;
let lubanButtonHoverStart = 0;
let lubanButtonTriggeredTarget = null;
let lubanButtonDwellProgress = 0;
let coverFadeAnimationFrame = null;

const BOUNDS = {
  xMin: -3.05,
  xMax: 3.05,
  yMin: 0.12,
  yMax: 3.48,
  zMin: -1.75,
  zMax: 1.35,
};

const SNAP_DISTANCE = 0.36;
const MAGNET_DISTANCE = 0.92;
const MAGNET_LERP = 0.075;
const SNAP_ROTATION_DISTANCE = 0.9;
const DEPTH_Z_NEAR = 0.82;
const DEPTH_Z_FAR = -1.18;
const DEPTH_SMOOTH_IDLE = 0.14;
const DEPTH_SMOOTH_GRAB = 0.22;
const COLLISION_SHRINK = 0.72;
const COLLISION_MIN_OVERLAP = 0.055;
const FINAL_DISPLAY_SCALE = 1.8;
const FINAL_DISPLAY_LERP = 0.03;
const FINAL_ROTATION_SPEED = 0.004;
const FINAL_CENTER_LERP = 0.045;
const FINAL_DISPLAY_CENTER = new THREE.Vector3(0, 1.28, 0);
const FINAL_DISPLAY_SCALE_VECTOR = new THREE.Vector3(
  FINAL_DISPLAY_SCALE,
  FINAL_DISPLAY_SCALE,
  FINAL_DISPLAY_SCALE
);
const BUILDING_NORMAL_SCALE = 1.0;
const BUILDING_EXPLODE_SCALE = 0.56;
const BUILDING_HOVER_DWELL_TIME = 1500;
const DWELL_TIME = 1500;
const COVER_ENTER_HIT_PADDING = 18;
const LUBAN_BUTTON_HIT_PADDING = 12;
const MODEL_VIEWER_CLOSE_HIT_PADDING = 56;
const HAND_POLL_INTERVAL = 70;
const CURSOR_POSITION_LERP = 0.42;

// v20: all original GLB files are exported in the same unit system.
// Single blocks have max dimension ≈ 10, so 0.165 makes a block length ≈ 1.65.
// Active blocks, step references, and final target all use this same scale.
const UNIT_SCALE = 0.165;
const TARGET_CENTER = new THREE.Vector3(0.000, 2.350, 0.000);
const TARGET_ORIGIN = new THREE.Vector3(0.000000, 2.185000, -0.002946);

const modelFiles = [
  { key: "luban_a", file: "luban_a.glb", targetFile: "target_a.glb", stepFile: "step_01_luban_a.glb", start: [-2.850000, 0.711750, 0.888250], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] },
  { key: "luban_b", file: "luban_b.glb", targetFile: "target_b.glb", stepFile: "step_02_luban_a_b.glb", start: [-1.696250, 0.555000, 1.041250], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] },
  { key: "luban_c", file: "luban_c.glb", targetFile: "target_c.glb", stepFile: "step_03_luban_a_b_c.glb", start: [-0.550000, 0.555000, 0.715000], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] },
  { key: "luban_d", file: "luban_d.glb", targetFile: "target_d.glb", stepFile: "step_04_luban_a_b_c_d.glb", start: [0.405625, 0.555000, 0.880000], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] },
  { key: "luban_e", file: "luban_e.glb", targetFile: "target_e.glb", stepFile: "step_05_luban_a_b_c_d_e.glb", start: [1.853214, 0.543214, 0.874107], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] },
  { key: "luban_f", file: "luban_f.glb", targetFile: "target_f.glb", stepFile: "step_06_luban_a_b_c_d_e_f_final.glb", start: [2.850000, 0.390000, 0.880000], target: [0.000000, 2.185000, -0.002946], startRot: [0, 0, 0], targetRot: [0, 0, 0] }
];

const viewerModelFiles = {
  luban_a: "viewer_luban_a.glb",
  luban_b: "viewer_luban_b.glb",
  luban_c: "viewer_luban_c.glb",
  luban_d: "viewer_luban_d.glb",
  luban_e: "viewer_luban_e.glb",
  luban_f: "viewer_luban_f.glb",
};

const buildingPartFiles = [
  "building_01.glb",
  "building_02.glb",
  "building_03.glb",
  "building_04.glb",
  "building_05.glb",
  "building_06.glb",
  "building_07.glb",
  "building_08.glb",
  "building_09.glb",
];

const buildingPartDescriptions = {
  building_01: {
    title: "구성 요소 01 · 기초 구조",
    body: "이 부재는 건축물의 하부를 지지하는 기본 구조로, 전체 목구조가 안정적으로 서 있을 수 있도록 무게와 균형을 받쳐 주는 역할을 합니다. 전통 목구조에서 기초부는 상부 구조의 힘을 분산시키는 중요한 시작점입니다."
  },
  building_02: {
    title: "구성 요소 02 · 수직 지지 구조",
    body: "이 부재는 건축물의 수직 방향을 형성하는 지지 요소입니다. 기둥과 같은 역할을 하며, 상부의 하중을 아래로 전달하고 전체 구조의 높이와 비례를 결정합니다."
  },
  building_03: {
    title: "구성 요소 03 · 수평 결합 구조",
    body: "이 부재는 좌우로 이어지는 수평 구조로, 여러 지지 요소를 서로 연결하고 공간의 폭을 형성합니다. 전통 목구조에서는 수평 결합부가 안정성과 구조적 리듬을 만드는 핵심 역할을 합니다."
  },
  building_04: {
    title: "구성 요소 04 · 연결 및 받침 구조",
    body: "이 부재는 상부와 하부 구조를 연결하며 힘의 흐름을 조절하는 중간 결합 요소입니다. 짜맞춤 구조에서는 이러한 연결부가 못이나 접착제 없이 구조를 고정하는 중요한 장치가 됩니다."
  },
  building_05: {
    title: "구성 요소 05 · 지붕 하부 골조",
    body: "이 부재는 지붕을 받치는 하부 골조에 해당합니다. 지붕의 형태를 안정적으로 유지하고, 상부 구조의 무게를 여러 방향으로 분산시키는 역할을 합니다."
  },
  building_06: {
    title: "구성 요소 06 · 지붕 구조",
    body: "이 부재는 건축물의 상부를 덮는 지붕 구조입니다. 외부 환경으로부터 내부 공간을 보호하며, 전통 건축의 실루엣과 시각적 인상을 결정하는 중요한 요소입니다."
  },
  building_07: {
    title: "구성 요소 07 · 공간을 형성하는 면 구조",
    body: "이 부재는 건축물의 내부와 외부를 구분하고 공간감을 형성하는 요소입니다. 벽체나 외피와 같은 역할을 하며, 구조적 안정성과 시각적 완성도를 함께 제공합니다."
  },
  building_08: {
    title: "구성 요소 08 · 세부 장식 및 보조 구조",
    body: "이 부재는 건축물의 세부 표현을 담당하는 요소입니다. 작은 보조 구조나 장식적 부재는 전체 형태에 정교함을 더하고, 전통 목구조의 섬세한 조형성을 보여 줍니다."
  },
  building_09: {
    title: "구성 요소 09 · 완성 구조를 위한 통합 요소",
    body: "이 부재는 전체 구조의 완성도를 높이는 통합적 요소입니다. 다른 부재들과 결합하면서 건축물의 형태를 마무리하고, 구조적 균형과 시각적 완결성을 강화합니다."
  }
};

const i18n = {
  ko: {
    coverTitle: "짜맞춤 구조 인터랙티브 전시",
    coverSubtitle: "손동작으로 만나는 전통 목구조",
    enterSystem: "전시 시작",
    systemEyebrow: "짜맞춤 구조 인터랙티브 시스템",
    buildingTitle: "전통 목구조 건축 전시",
    buildingSubtitle: "손동작 기반 구조 인터랙션",
    buildingPlaceholder: "건축 모델 준비 중",
    buildingPlaceholderSub: "전통 목구조 모델을 준비하고 있습니다",
    buildingHint: "손바닥을 펼치면 구조가 분해되고, 주먹을 쥐면 원래 형태로 돌아갑니다.",
    buildingPartViewerEyebrow: "건축 부재 보기",
    buildingViewerHint: "손을 움직이면 모델을 회전해서 볼 수 있습니다.<br>돌아가기 영역에 1.5초 머무르면 건축 전시 화면으로 돌아갑니다.",
    lubanEntry: "▦ 노반쇄 체험",
    backToBuilding: "건축 전시로 돌아가기",
    lubanTitle: "노반쇄 손동작 조립 체험",
    lubanSubtitle: "손동작으로 여섯 개의 목재 블록을 순서대로 조립하며 전통 짜맞춤 구조를 체험합니다.",
    modelView: "▦ 모델 보기",
    modelViewTitle: "모델 보기",
    viewerEyebrow: "노반쇄 구성 블록",
    start: "시작",
    musicOn: "음악 켜짐",
    musicOff: "음악 꺼짐",
    autoAssembly: "자동 조립",
    reset: "초기화",
    mirror: "좌우 반전",
    help: "조작 안내",
    close: "닫기",
    back: "돌아가기",
    complete: "완성",
    step: "단계",
    needBlock: "필요 블록",
    finalIntroTitle: "노반쇄 · 전통 짜맞춤 구조",
    finalIntroBody: "노반쇄는 중국 전통 목구조의 지혜를 담은 짜맞춤 구조 장난감입니다. 못이나 접착제를 사용하지 않고, 나무 조각 사이의 정교한 맞물림을 통해 안정적인 구조를 완성합니다. 사용자는 손동작을 통해 조립 순서와 구조적 균형을 체험하며, 전통 구조 속의 결합 방식과 공간적 사고를 직관적으로 이해할 수 있습니다.",
    help1: "주먹을 쥐면 현재 단계의 목재 블록을 잡을 수 있습니다.",
    help2: "손을 카메라에 가까이 가져가면 모델이 앞으로 이동합니다.",
    help3: "손을 카메라에서 멀리하면 모델이 뒤로 이동합니다.",
    help4: "올바른 위치에 가까워지면 부드럽게 흡착됩니다.",
    help5: "흡착된 블록은 고정되며 다시 움직일 수 없습니다.",
    help6: "좌우 버튼 영역에서 주먹을 쥐면 전체 구조를 회전할 수 있습니다.",
    help7: "여섯 개 블록을 모두 조립하면 완성된 노반쇄가 확대되어 천천히 회전합니다."
  },
  zh: {
    coverTitle: "榫卯结构互动展示",
    coverSubtitle: "用手势体验传统木构",
    enterSystem: "进入系统",
    systemEyebrow: "榫卯结构互动系统",
    buildingTitle: "传统木构建筑展示",
    buildingSubtitle: "基于手势的结构互动",
    buildingPlaceholder: "建筑模型准备中",
    buildingPlaceholderSub: "正在准备传统木构模型",
    buildingHint: "张开手掌，结构分解展示；握拳，结构恢复原型。",
    buildingPartViewerEyebrow: "建筑部件查看",
    buildingViewerHint: "移动手部即可旋转查看模型。<br>在返回区域停留 1.5 秒可回到建筑展示画面。",
    lubanEntry: "▦ 鲁班锁体验",
    backToBuilding: "返回建筑展示",
    lubanTitle: "鲁班锁手势拼装体验",
    lubanSubtitle: "用手势按顺序拼装六个木块，体验传统榫卯结构。",
    modelView: "▦ 模型展示",
    modelViewTitle: "模型展示",
    viewerEyebrow: "鲁班锁构件",
    start: "开始",
    musicOn: "音乐开",
    musicOff: "音乐关",
    autoAssembly: "自动拼装",
    reset: "重置",
    mirror: "镜像切换",
    help: "操作说明",
    close: "关闭",
    back: "返回",
    complete: "完成",
    step: "步骤",
    needBlock: "需要木块",
    finalIntroTitle: "鲁班锁 · 传统榫卯结构",
    finalIntroBody: "鲁班锁是一种体现中国传统木作智慧的榫卯结构玩具。它不使用钉子或胶水，而是通过木块之间精巧的咬合完成稳定结构。使用者可以通过手势体验组装顺序与结构平衡，直观理解传统结构中的连接方式与空间思维。",
    help1: "握拳可以抓取当前步骤的木块。",
    help2: "手靠近摄像头时，模型会向前移动。",
    help3: "手远离摄像头时，模型会向后移动。",
    help4: "靠近正确位置时会平滑吸附。",
    help5: "吸附后的木块会固定，不能再次移动。",
    help6: "在左右按钮区域握拳可以旋转整体结构。",
    help7: "完成六个木块后，鲁班锁会放大并缓慢旋转。"
  },
  en: {
    coverTitle: "Mortise-and-Tenon Interactive Exhibition",
    coverSubtitle: "Explore traditional timber craft with hand gestures",
    enterSystem: "Start Exhibition",
    systemEyebrow: "Mortise-and-Tenon Interactive System",
    buildingTitle: "Traditional Timber Architecture",
    buildingSubtitle: "Gesture-based structural interaction",
    buildingPlaceholder: "Preparing Architecture Model",
    buildingPlaceholderSub: "Traditional timber model is loading",
    buildingHint: "Open your palm to explode the structure; make a fist to restore it.",
    buildingPartViewerEyebrow: "Building Part Viewer",
    buildingViewerHint: "Move your hand to rotate the model.<br>Stay over the Back area for 1.5 seconds to return to the architecture view.",
    lubanEntry: "▦ Luban Lock",
    backToBuilding: "Back to Architecture",
    lubanTitle: "Luban Lock Gesture Assembly",
    lubanSubtitle: "Assemble six wooden blocks in order and explore traditional interlocking structures.",
    modelView: "▦ Model View",
    modelViewTitle: "Model View",
    viewerEyebrow: "Luban Components",
    start: "Start",
    musicOn: "Music On",
    musicOff: "Music Off",
    autoAssembly: "Auto Assembly",
    reset: "Reset",
    mirror: "Mirror",
    help: "Guide",
    close: "Close",
    back: "Back",
    complete: "Complete",
    step: "Step",
    needBlock: "Need",
    finalIntroTitle: "Luban Lock · Traditional Interlocking Structure",
    finalIntroBody: "The Luban lock is a traditional interlocking wooden structure that reflects the wisdom of Chinese timber craft. Without nails or glue, it forms a stable structure through precise connections between wooden pieces. Through hand gestures, users can experience assembly order, structural balance, and spatial thinking in traditional joinery.",
    help1: "Make a fist to grab the wooden block for the current step.",
    help2: "Move your hand closer to the camera to move the model forward.",
    help3: "Move your hand away from the camera to move the model backward.",
    help4: "When the block is near the correct position, it will snap smoothly.",
    help5: "Snapped blocks are locked and cannot be moved again.",
    help6: "Make a fist in the left or right control zone to rotate the whole structure.",
    help7: "After all six blocks are assembled, the completed Luban lock enlarges and rotates slowly."
  }
};

const buildingPartDescriptionsAlt = {
  zh: {
    building_01: { title: "构成元素 01 · 基础结构", body: "该部件支撑建筑下部，是让整体木构稳定站立的基础结构。它承托重量并保持平衡，在传统木构中是分散上部受力的重要起点。" },
    building_02: { title: "构成元素 02 · 垂直支撑结构", body: "该部件形成建筑的垂直方向，类似柱子的作用。它将上部荷载向下传递，并决定整体结构的高度与比例。" },
    building_03: { title: "构成元素 03 · 水平连接结构", body: "该部件沿水平方向连接多个支撑元素，形成空间宽度。传统木构中的水平连接部件，是稳定性与结构节奏的重要来源。" },
    building_04: { title: "构成元素 04 · 连接与承托结构", body: "该部件连接上下结构，并调节力的传递路径。在榫卯结构中，这类连接部件是不使用钉胶也能固定结构的重要装置。" },
    building_05: { title: "构成元素 05 · 屋顶下部骨架", body: "该部件属于支撑屋顶的下部骨架。它维持屋顶形态，并将上部重量向多个方向分散。" },
    building_06: { title: "构成元素 06 · 屋顶结构", body: "该部件覆盖建筑上部，保护内部空间，也决定传统建筑的轮廓与视觉印象。" },
    building_07: { title: "构成元素 07 · 空间围合面结构", body: "该部件区分建筑内外并形成空间感，类似墙体或外皮，同时提供结构稳定性与视觉完整度。" },
    building_08: { title: "构成元素 08 · 细部装饰与辅助结构", body: "该部件负责建筑细部表达。小型辅助或装饰构件为整体形态增添精巧感，展现传统木构的细腻造型。" },
    building_09: { title: "构成元素 09 · 完整结构的整合元素", body: "该部件提升整体结构的完成度，与其他部件结合后收束建筑形态，并强化结构平衡与视觉完整性。" }
  },
  en: {
    building_01: { title: "Component 01 · Foundation Structure", body: "This component supports the lower part of the building. It carries weight and balance so the timber structure can stand securely, serving as the starting point for distributing upper loads." },
    building_02: { title: "Component 02 · Vertical Support", body: "This component forms the vertical direction of the architecture. Like a column, it transfers upper loads downward and defines the height and proportion of the structure." },
    building_03: { title: "Component 03 · Horizontal Joint", body: "This horizontal component connects multiple supports and defines the width of the space. In traditional timber structures, horizontal joints create stability and structural rhythm." },
    building_04: { title: "Component 04 · Connecting Support", body: "This component connects upper and lower structures while guiding the flow of force. Such joints allow timber structures to lock together without nails or glue." },
    building_05: { title: "Component 05 · Roof Substructure", body: "This component belongs to the lower frame supporting the roof. It helps maintain the roof form and distributes the weight of upper elements in several directions." },
    building_06: { title: "Component 06 · Roof Structure", body: "This component covers the top of the building, protects the interior space, and shapes the silhouette and visual impression of traditional architecture." },
    building_07: { title: "Component 07 · Spatial Surface", body: "This component separates interior and exterior space and helps define enclosure. Like a wall or outer skin, it contributes to both stability and visual completion." },
    building_08: { title: "Component 08 · Detail and Auxiliary Structure", body: "This component expresses architectural detail. Small auxiliary and decorative elements add refinement and reveal the delicate form of traditional timber craft." },
    building_09: { title: "Component 09 · Integrating Element", body: "This component completes the overall structure. By joining with the other parts, it finishes the architectural form and strengthens structural balance and visual unity." }
  }
};

function $(id) {
  return document.getElementById(id);
}

function t(key) {
  return (i18n[currentLang] && i18n[currentLang][key]) || i18n.ko[key] || key;
}

function setLanguage(lang) {
  if (!i18n[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh" : lang;
  document.title = t("coverTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key || !i18n[lang][key]) return;
    el.textContent = i18n[lang][key];
  });

  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === lang);
  });

  updateMusicButton(musicEnabled);
  updateStepUI();
  updateBuildingPartViewerText();
}

function getBuildingPartDescription(partKey) {
  const normalizedKey = partKey.startsWith("building_") ? partKey : `building_${partKey}`;
  if (currentLang === "ko") return buildingPartDescriptions[normalizedKey] || { title: normalizedKey, body: "" };
  return buildingPartDescriptionsAlt[currentLang]?.[normalizedKey]
    || buildingPartDescriptions[normalizedKey]
    || { title: normalizedKey, body: "" };
}

function updateBuildingPartViewerText() {
  if (!buildingPartViewerActive) return;
  const title = $("buildingPartViewerTitle");
  const body = $("buildingPartViewerBody");
  const hint = $("buildingPartViewerHint");
  const activeKey = $("buildingPartViewer")?.dataset.partKey;
  const description = activeKey ? getBuildingPartDescription(activeKey) : null;
  if (description && title) title.textContent = description.title;
  if (description && body) body.textContent = description.body;
  if (hint) hint.innerHTML = t("buildingViewerHint");
}

function log(msg) {
  console.log("[v17]", msg);
  const box = $("log");
  if (box) box.innerHTML = `${new Date().toLocaleTimeString()} · ${msg}<br>` + box.innerHTML;
}

window.addEventListener("error", (event) => {
  try {
    log("RUNTIME ERROR: " + (event.message || "unknown"));
  } catch (e) {}
});

window.addEventListener("unhandledrejection", (event) => {
  try {
    log("PROMISE ERROR: " + (event.reason?.message || String(event.reason || "unknown")));
  } catch (e) {}
});


function ensureAudioContext() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    logOnce("audio init failed: " + err.message);
  }
}

function playTone(freq = 520, duration = 0.08, gainValue = 0.045, type = "sine") {
  ensureAudioContext();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, audioCtx.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration + 0.015);
}

function playMagnetSound() {
  playTone(520, 0.055, 0.025, "sine");
}

function playSnapSound() {
  playTone(660, 0.075, 0.045, "triangle");
  setTimeout(() => playTone(880, 0.085, 0.035, "triangle"), 70);
}

function preload() {
  try {
    handPose = ml5.handPose();
    log("ml5.handPose created in preload");
  } catch (err) {
    log("ml5.handPose preload failed: " + err.message);
  }
}

function setup() {
  const c = createCanvas(window.innerWidth, window.innerHeight);
  c.parent("p5OverlayContainer");
  clear();

  $("cameraStatus").textContent = "대기 중";
  $("handStatus").textContent = "대기 중";
  if (currentScreen === "cover" || currentScreen === "building" || currentScreen === "lubanGame") {
    startHandPoseIfNeeded();
  }
}

function startHandPoseIfNeeded() {
  if (handPoseStarted) return;

  try {
    if (!handPose) {
      handPose = ml5.handPose();
      log("ml5.handPose created in setup");
    }

    video = createCapture({
      video: {
        width: 640,
        height: 480,
        facingMode: "user",
      },
      audio: false,
    });
    video.size(640, 480);
    video.parent("cameraSource");
    video.elt.setAttribute("playsinline", "");
    video.elt.muted = true;
    video.elt.autoplay = true;
    video.elt.play().catch(() => {});
    video.elt.addEventListener("loadeddata", startHandPoseDetection, { once: true });
    video.elt.addEventListener("playing", startHandPoseDetection, { once: true });
    handPoseStarted = true;
    initGameCameraPreview();
    syncBuildingCameraPreview();
    $("cameraStatus").textContent = "카메라 준비됨";
    $("videoPreview").classList.toggle("mirrored", mirrorInteraction);
    log("p5 createCapture ready");

    startHandPoseDetection();
    setTimeout(() => {
      if (!hands.length) startHandPoseP5Fallback();
    }, 1600);
  } catch (err) {
    handPoseStarted = false;
    $("handStatus").textContent = "HandPose 오류";
    log("setup / detectStart failed: " + err.message);
  }
}

function startHandPoseDetection() {
  if (!handPose || !video || !video.elt || handPoseNativeDetectStarted) return;
  try {
    handPose.detectStart(video.elt, gotHands);
    handPoseDetectStarted = true;
    handPoseNativeDetectStarted = true;
    $("handStatus").textContent = "감지 시작";
    log("handPose.detectStart(native video) called");
  } catch (err) {
    logOnce("handPose.detectStart native video failed: " + err.message);
    startHandPoseP5Fallback();
  }
}

function startHandPoseNativeFallback() {
  if (!handPose || !video || !video.elt || handPoseNativeDetectStarted || hands.length > 0) return;
  try {
    handPose.detectStart(video.elt, gotHands);
    handPoseNativeDetectStarted = true;
    $("handStatus").textContent = "감지 재시도";
    log("handPose.detectStart(native video) fallback called");
  } catch (err) {
    logOnce("handPose native fallback failed: " + err.message);
  }
}

function startHandPoseP5Fallback() {
  if (!handPose || !video || handPoseP5DetectStarted || hands.length > 0) return;
  try {
    handPose.detectStart(video, gotHands);
    handPoseDetectStarted = true;
    handPoseP5DetectStarted = true;
    $("handStatus").textContent = "감지 시작";
    log("handPose.detectStart(p5 video) fallback called");
  } catch (err) {
    logOnce("handPose p5 fallback failed: " + err.message);
  }
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  resizeThree();
  resizeBuildingScene();
}

function draw() {
  try {
    clear();
    pollHandPoseIfNeeded();
    updateCursorFromHands();
    drawCursor();
    updateAllCameraPreviews();
    if (currentScreen === "cover") {
      updateCoverInteraction();
    }
    if (currentScreen === "building") {
      updateBuildingInteraction();
    }
    if (currentScreen === "lubanGame") {
      drawSideRotateZones();
      updateLubanButtonDwell();
      handleGestureControl();
    }
  } catch (err) {
    logOnce("draw loop error: " + err.message);
  }
}

function gotHands(results) {
  const nextHands = results || [];
  if (nextHands.length > 0) {
    hands = nextHands;
    lastHandsSeenTime = performance.now();
  } else if (performance.now() - lastHandsSeenTime > 450) {
    hands = [];
  }

  $("handsCount").textContent = hands.length;
  if (hands.length > 0) {
    $("handStatus").textContent = "손 감지됨";
  } else if (handPoseStarted) {
    $("handStatus").textContent = "감지 중";
  }
}

function pollHandPoseIfNeeded() {
  if (!handPoseStarted || handPosePollActive) return;
  if (!handPose || typeof handPose.detect !== "function" || !video || !video.elt) return;
  if (!video.elt.videoWidth && video.elt.readyState < 2) return;

  const now = performance.now();
  if (now - lastHandPosePollTime < HAND_POLL_INTERVAL) return;
  lastHandPosePollTime = now;
  handPosePollActive = true;

  pollHandPoseWithFallback();
}

async function pollHandPoseWithFallback() {
  try {
    let results = await detectHandsFromInput(video.elt);
    if ((!results || results.length === 0) && video) {
      results = await detectHandsFromInput(video);
    }
    gotHands(results || []);
  } catch (err) {
    logOnce("handPose.detect poll error: " + err.message);
  } finally {
    handPosePollActive = false;
  }
}

async function detectHandsFromInput(input) {
  if (!handPose || typeof handPose.detect !== "function" || !input) return [];
  const detected = handPose.detect(input);
  if (detected && typeof detected.then === "function") {
    return detected;
  }
  return detected || [];
}

function getHandPoint(hand, namedKey, fallbackIndex) {
  if (hand && hand[namedKey] && typeof hand[namedKey].x === "number") {
    return hand[namedKey];
  }

  if (hand && Array.isArray(hand.keypoints)) {
    const named = hand.keypoints.find((p) => p.name === namedKey);
    if (named && typeof named.x === "number") return named;
    const idx = hand.keypoints[fallbackIndex];
    if (idx && typeof idx.x === "number") return idx;
  }

  if (hand && Array.isArray(hand.landmarks) && hand.landmarks[fallbackIndex]) {
    const p = hand.landmarks[fallbackIndex];
    if (Array.isArray(p)) return { x: p[0], y: p[1], z: p[2] || 0 };
  }

  return null;
}

function getVideoFrameSize() {
  const source = video && video.elt ? video.elt : null;
  return {
    width: (source && source.videoWidth) || (video && video.width) || 640,
    height: (source && source.videoHeight) || (video && video.height) || 480,
  };
}

function isNormalizedPoint(point) {
  return point && Math.abs(point.x) <= 1.5 && Math.abs(point.y) <= 1.5;
}

function handPointToNormalized(point) {
  if (!point) return { x: 0.5, y: 0.5 };
  const { width: vw, height: vh } = getVideoFrameSize();
  const nx = isNormalizedPoint(point) ? point.x : point.x / vw;
  const ny = isNormalizedPoint(point) ? point.y : point.y / vh;
  return {
    x: constrain(nx, 0, 1),
    y: constrain(ny, 0, 1),
  };
}

function updateCursorFromHands() {
  if (!hands || hands.length === 0) {
    cursor.visible = false;
    cursor.gesture = "inactive";
    $("gestureStatus").textContent = "손 없음";
    return;
  }

  const hand = hands[0];
  const indexTip = getHandPoint(hand, "index_finger_tip", 8);
  const indexMcp = getHandPoint(hand, "index_finger_mcp", 5);
  const pinkyMcp = getHandPoint(hand, "pinky_finger_mcp", 17);
  const wrist = getHandPoint(hand, "wrist", 0);
  const middleMcp = getHandPoint(hand, "middle_finger_mcp", 9);

  if (!indexTip) {
    cursor.visible = false;
    cursor.gesture = "inactive";
    $("gestureStatus").textContent = "검지점 없음";
    logOnce("no index keypoint. hand keys: " + Object.keys(hand).join(", "));
    return;
  }

  let { x: nx, y: ny } = handPointToNormalized(indexTip);

  // Same direction as the mirrored camera preview.
  const displayX = mirrorInteraction ? 1 - nx : nx;
  const fingerState = getFingerState(hand);
  const fist = isFistGesture(fingerState);

  let handAngle = 0;
  if (indexMcp && pinkyMcp) {
    handAngle = Math.atan2(indexMcp.y - pinkyMcp.y, indexMcp.x - pinkyMcp.x);
  } else if (wrist && middleMcp) {
    handAngle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);
  }

  if (mirrorInteraction) handAngle = -handAngle;

  // Hand depth: closer to the camera usually means larger keypoint distance.
  const handSpan = getHandSpan(hand);
  const targetDepthZ = mapHandSpanToDepth(handSpan);
  const depthZ = THREE.MathUtils.lerp(
    cursor.depthZ,
    targetDepthZ,
    fist ? DEPTH_SMOOTH_GRAB : DEPTH_SMOOTH_IDLE
  );

  cursor.previousX = cursor.x;
  cursor.previousY = cursor.y;
  cursor.rawX = nx;
  cursor.rawY = ny;
  cursor.x = cursor.visible
    ? THREE.MathUtils.lerp(cursor.x, displayX, CURSOR_POSITION_LERP)
    : displayX;
  cursor.y = cursor.visible
    ? THREE.MathUtils.lerp(cursor.y, ny, CURSOR_POSITION_LERP)
    : ny;
  cursor.visible = true;
  cursor.fist = fist;
  cursor.handAngle = handAngle;
  cursor.handSpan = handSpan;
  cursor.depthZ = depthZ;
  cursor.targetDepthZ = targetDepthZ;

  if (fist && isCursorInLeftZone()) {
    cursor.gesture = "rotateLeft";
  } else if (fist && isCursorInRightZone()) {
    cursor.gesture = "rotateRight";
  } else if (fist) {
    cursor.gesture = "grab";
  } else {
    cursor.gesture = "inactive";
  }

  const label = {
    grab: "주먹 / 블록 잡기",
    rotateLeft: "주먹 / 왼쪽 회전",
    rotateRight: "주먹 / 오른쪽 회전",
    inactive: "대기",
  }[cursor.gesture];

  $("gestureStatus").textContent = label;
  $("cursorStatus").textContent = `x:${displayX.toFixed(2)} y:${ny.toFixed(2)} z:${depthZ.toFixed(2)} span:${Math.round(handSpan)} curled:${fingerState.curled}`;
}

function getHandSpan(hand) {
  const indexMcp = getHandPoint(hand, "index_finger_mcp", 5);
  const pinkyMcp = getHandPoint(hand, "pinky_finger_mcp", 17);
  const wrist = getHandPoint(hand, "wrist", 0);
  const middleMcp = getHandPoint(hand, "middle_finger_mcp", 9);

  const scaleSpan = (value) => {
    if (value < 2) {
      const { width: vw, height: vh } = getVideoFrameSize();
      return value * Math.min(vw, vh);
    }
    return value;
  };

  if (indexMcp && pinkyMcp) {
    return scaleSpan(dist(indexMcp.x, indexMcp.y, pinkyMcp.x, pinkyMcp.y));
  }

  if (wrist && middleMcp) {
    return scaleSpan(dist(wrist.x, wrist.y, middleMcp.x, middleMcp.y));
  }

  return 90;
}

function mapHandSpanToDepth(span) {
  // Bigger hand span means hand is closer to camera.
  // Requirement: hand closer to camera => block goes deeper into the frame.
  // Camera is at positive Z looking toward origin; deeper into screen is more negative Z.
  const s = constrain(span, 60, 155);
  let t = (s - 60) / (155 - 60);
  t = t * t * (3 - 2 * t);
  return lerp(DEPTH_Z_NEAR, DEPTH_Z_FAR, t);
}

function countExtendedFingers(hand) {
  return getFingerState(hand).extended;
}

function getFingerState(hand) {
  const wrist = getHandPoint(hand, "wrist", 0);
  if (!wrist) return { extended: 5, curled: 0, known: 0 };
  const normalized = isNormalizedPoint(wrist);
  const fingerThreshold = normalized ? 0.035 : 18;
  const thumbThreshold = normalized ? 0.024 : 12;

  const fingerPairs = [
    ["index_finger_tip", 8, "index_finger_pip", 6],
    ["middle_finger_tip", 12, "middle_finger_pip", 10],
    ["ring_finger_tip", 16, "ring_finger_pip", 14],
    ["pinky_finger_tip", 20, "pinky_finger_pip", 18],
  ];

  let count = 0;
  let curled = 0;
  let known = 0;
  fingerPairs.forEach(([tipName, tipIndex, pipName, pipIndex]) => {
    const tip = getHandPoint(hand, tipName, tipIndex);
    const pip = getHandPoint(hand, pipName, pipIndex);
    if (!tip || !pip) return;
    known++;
    const tipD = dist(tip.x, tip.y, wrist.x, wrist.y);
    const pipD = dist(pip.x, pip.y, wrist.x, wrist.y);
    if (tipD > pipD + fingerThreshold) count++;
    else curled++;
  });

  const thumbTip = getHandPoint(hand, "thumb_tip", 4);
  const thumbIp = getHandPoint(hand, "thumb_ip", 3);
  if (thumbTip && thumbIp) {
    known++;
    const tipD = dist(thumbTip.x, thumbTip.y, wrist.x, wrist.y);
    const ipD = dist(thumbIp.x, thumbIp.y, wrist.x, wrist.y);
    if (tipD > ipD + thumbThreshold) count++;
    else curled++;
  }

  return { extended: count, curled, known };
}

function isFistGesture(state) {
  if (!state || state.known < 4) return false;
  return state.curled >= 3 && state.extended <= 1;
}

let lastLogMessage = "";
function logOnce(msg) {
  if (msg !== lastLogMessage) {
    lastLogMessage = msg;
    log(msg);
  }
}

function leftZoneRect() {
  const w = Math.min(76, Math.max(54, width * 0.075));
  const h = Math.min(118, Math.max(82, height * 0.16));
  return { x: 20, y: height / 2 - h / 2, w, h, cx: 20 + w / 2, cy: height / 2 };
}

function rightZoneRect() {
  const w = Math.min(76, Math.max(54, width * 0.075));
  const h = Math.min(118, Math.max(82, height * 0.16));
  return { x: width - w - 20, y: height / 2 - h / 2, w, h, cx: width - 20 - w / 2, cy: height / 2 };
}

function pointInRect(x, y, zone) {
  return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
}

function isCursorInLeftZone() {
  if (!cursor.visible) return false;
  return pointInRect(cursor.x * width, cursor.y * height, leftZoneRect());
}

function isCursorInRightZone() {
  if (!cursor.visible) return false;
  return pointInRect(cursor.x * width, cursor.y * height, rightZoneRect());
}

function drawSideRotateZones() {
  const l = leftZoneRect();
  const r = rightZoneRect();
  const leftActive = cursor.visible && isCursorInLeftZone();
  const rightActive = cursor.visible && isCursorInRightZone();

  drawRotateButton(l, "‹", "LEFT", leftActive);
  drawRotateButton(r, "›", "RIGHT", rightActive);
}

function drawRotateButton(zone, arrow, label, active) {
  push();
  const radius = 14;
  noStroke();
  fill(active ? color(244, 215, 154, 52) : color(244, 215, 154, 18));
  rectMode(CORNER);
  rect(zone.x, zone.y, zone.w, zone.h, radius);

  stroke(active ? color(255, 255, 255, 230) : color(244, 215, 154, 125));
  strokeWeight(active ? 3 : 2);
  noFill();
  rect(zone.x, zone.y, zone.w, zone.h, radius);

  noStroke();
  fill(active ? color(255, 255, 255) : color(244, 215, 154, 185));
  textAlign(CENTER, CENTER);
  textSize(36);
  text(arrow, zone.cx, zone.cy - 7);

  textSize(12);
  text(label, zone.cx, zone.cy + 30);
  pop();
}

function drawCursor() {
  if (!cursor.visible) return;

  const x = cursor.x * width;
  const y = cursor.y * height;

  noStroke();
  fill(255, 255, 255, 245);
  circle(x, y, cursor.fist ? 15 : 10);

  if (cursor.fist) {
    noFill();
    stroke(255, 255, 255, 175);
    strokeWeight(2);
    circle(x, y, 30);
  }

  if (currentScreen === "lubanGame" && lubanButtonDwellProgress > 0) {
    const progress = constrain(lubanButtonDwellProgress, 0, 1);
    noFill();
    stroke(244, 215, 154, 230);
    strokeWeight(3);
    arc(x, y, 40, 40, -HALF_PI, -HALF_PI + progress * TWO_PI);
    stroke(255, 255, 255, 80);
    strokeWeight(1.5);
    circle(x, y, 40);
  }
}

window.addEventListener("load", () => {
  bindButtons();
  initThree();
  loadModels();
  animateThree();
  tryPlayMusic();
  initCoverVideo();
  showScreen("cover");
  setLanguage("ko");
});

function bindButtons() {
  $("startBtn").addEventListener("click", () => {
    ensureAudioContext();
    startHandPoseIfNeeded();
    tryPlayMusic();
    log("Start clicked. p5/ml5 should be running.");
  });

  $("musicBtn").addEventListener("click", toggleMusic);

  const enterSystemBtn = $("enterSystemBtn");
  if (enterSystemBtn) enterSystemBtn.addEventListener("click", triggerEnterSystem);

  const openLubanGameBtn = $("openLubanGameBtn");
  if (openLubanGameBtn) openLubanGameBtn.addEventListener("click", triggerOpenLubanGame);

  const backToBuildingBtn = $("backToBuildingBtn");
  if (backToBuildingBtn) backToBuildingBtn.addEventListener("click", () => showScreen("building"));

  $("autoBtn").addEventListener("click", () => {
    autoAssembly = !autoAssembly;
    log(autoAssembly ? "auto assembly ON" : "auto assembly OFF");
  });

  $("resetBtn").addEventListener("click", resetPieces);

  $("mirrorBtn").addEventListener("click", () => {
    mirrorInteraction = !mirrorInteraction;
    $("videoPreview").classList.toggle("mirrored", mirrorInteraction);
    updateGameCameraPreview();
    updateBuildingCameraPreview();
    log("mirror interaction = " + mirrorInteraction);
  });

  const modelViewBtn = $("modelViewBtn");
  if (modelViewBtn) modelViewBtn.addEventListener("click", openModelViewer);

  const modelViewerCloseBtn = $("modelViewerCloseBtn");
  if (modelViewerCloseBtn) modelViewerCloseBtn.addEventListener("click", closeModelViewer);

  document.querySelectorAll(".viewer-model-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.modelKey;
      if (key) switchViewerModel(key);
    });
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  document.addEventListener("pointerdown", resumeHandPoseFromUserGesture, { passive: true });
  document.addEventListener("touchstart", resumeHandPoseFromUserGesture, { passive: true });
}

function resumeHandPoseFromUserGesture() {
  startHandPoseIfNeeded();
  if (video && video.elt) {
    video.elt.play().catch(() => {});
  }
}

function initCoverVideo() {
  const coverVideo = $("coverVideo");
  if (!coverVideo) {
    console.warn("coverVideo not found");
    return;
  }

  coverVideo.muted = true;
  coverVideo.loop = true;
  coverVideo.playsInline = true;
  coverVideo.addEventListener("error", () => {
    console.warn("cover video failed to load: ./assets/cover/cover_intro.mp4");
  }, { once: true });
  coverVideo.addEventListener("loadedmetadata", updateCoverVideoFade);
  coverVideo.addEventListener("seeked", updateCoverVideoFade);
  coverVideo.addEventListener("timeupdate", updateCoverVideoFade);
  coverVideo.addEventListener("play", startCoverVideoFadeLoop);

  coverVideo.load();
  coverVideo.play().catch((err) => {
    console.warn("cover video autoplay blocked or failed:", err);
  });
  startCoverVideoFadeLoop();
}

function enterSystem() {
  const coverVideo = $("coverVideo");
  if (coverVideo) coverVideo.pause();
  stopCoverVideoFadeLoop();
  showScreen("building");
}

function triggerEnterSystem() {
  resumeMusicOnce();
  resetCoverDwell();
  enterSystem();
}

function triggerOpenLubanGame() {
  resumeMusicOnce();
  resetLubanEntryDwell();
  showScreen("lubanGame");
}

function updateCoverVideoFade() {
  const coverVideo = $("coverVideo");
  const coverFadeOverlay = $("coverFadeOverlay");
  if (!coverVideo || !coverFadeOverlay) return;

  const duration = coverVideo.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    coverFadeOverlay.style.opacity = "1";
    return;
  }

  const fadeDuration = Math.min(1.8, duration / 3);
  const t = coverVideo.currentTime;
  let opacity = 0;

  if (t < fadeDuration) {
    opacity = 1 - t / fadeDuration;
  } else if (duration - t < fadeDuration) {
    opacity = 1 - (duration - t) / fadeDuration;
  }

  coverFadeOverlay.style.opacity = THREE.MathUtils.clamp(opacity, 0, 1).toFixed(3);
}

function startCoverVideoFadeLoop() {
  if (coverFadeAnimationFrame) return;

  const tick = () => {
    updateCoverVideoFade();
    if (currentScreen === "cover") {
      coverFadeAnimationFrame = requestAnimationFrame(tick);
    } else {
      coverFadeAnimationFrame = null;
    }
  };

  tick();
}

function stopCoverVideoFadeLoop() {
  if (!coverFadeAnimationFrame) return;
  cancelAnimationFrame(coverFadeAnimationFrame);
  coverFadeAnimationFrame = null;
}

function tryPlayMusic() {
  const audio = $("bgMusic");
  if (!audio || !musicEnabled) return;

  audio.volume = 0.28;
  audio.loop = true;
  updateMusicButton(true);

  audio.play().then(() => {
    updateMusicButton(true);
  }).catch(() => {
    attachMusicResumeListeners();
  });
}

function attachMusicResumeListeners() {
  if (musicResumeListenerAttached) return;
  musicResumeListenerAttached = true;
  document.addEventListener("click", resumeMusicOnce, { once: true });
  document.addEventListener("touchstart", resumeMusicOnce, { once: true });
}

function resumeMusicOnce() {
  musicResumeListenerAttached = false;
  if (!musicEnabled) return;

  const audio = $("bgMusic");
  if (!audio) return;

  audio.volume = 0.28;
  audio.loop = true;
  updateMusicButton(true);
  audio.play().then(() => {
    updateMusicButton(true);
  }).catch(() => {
    attachMusicResumeListeners();
  });
}

function toggleMusic() {
  const audio = $("bgMusic");
  if (!audio) return;

  if (musicEnabled) {
    musicEnabled = false;
    audio.pause();
    updateMusicButton(false);
  } else {
    musicEnabled = true;
    audio.volume = 0.28;
    audio.loop = true;
    updateMusicButton(true);
    audio.play().then(() => {
      updateMusicButton(true);
    }).catch(() => {
      attachMusicResumeListeners();
    });
  }
}

function updateMusicButton(isPlaying) {
  const btn = $("musicBtn");
  if (!btn) return;
  btn.textContent = isPlaying ? t("musicOn") : t("musicOff");
  btn.title = isPlaying ? t("musicOn") : t("musicOff");
  btn.classList.toggle("muted", !isPlaying);
}

function showScreen(screenName) {
  currentScreen = screenName;

  const cover = $("coverScreen");
  const building = $("buildingScene");
  const luban = $("lubanGameScreen");

  if (cover) cover.classList.toggle("hidden", screenName !== "cover");
  if (building) building.classList.toggle("hidden", screenName !== "building");
  if (luban) luban.classList.toggle("hidden", screenName !== "lubanGame");

  const coverVideo = $("coverVideo");
  if (coverVideo) {
    if (screenName === "cover") {
      coverVideo.muted = true;
      coverVideo.loop = true;
      if (coverVideo.readyState === 0) coverVideo.load();
      coverVideo.play().catch((err) => {
        console.warn("cover video autoplay blocked or failed:", err);
      });
      startCoverVideoFadeLoop();
      startHandPoseIfNeeded();
    } else {
      coverVideo.pause();
      stopCoverVideoFadeLoop();
      resetCoverDwell();
      const coverCursor = $("coverCursor");
      if (coverCursor) coverCursor.classList.add("is-hidden");
    }
  }

  if (screenName === "building") {
    initBuildingSceneIfNeeded();
    resizeBuildingScene();
    startHandPoseIfNeeded();
    syncBuildingCameraPreview();
  } else {
    const buildingCursor = $("buildingCursor");
    if (buildingCursor) buildingCursor.classList.add("is-hidden");
  }

  if (screenName === "lubanGame") {
    initGameCameraPreview();
    updateGameCameraPreview();
    resizeThree();
    if (typeof resizeCanvas === "function") {
      resizeCanvas(window.innerWidth, window.innerHeight);
    }
    startHandPoseIfNeeded();
  }
}

function syncBuildingCameraPreview() {
  initBuildingCameraPreview();
  updateBuildingCameraPreview();
}

function updateAllCameraPreviews() {
  updateBuildingCameraPreview();
  updateLubanCameraPreview();
}

function drawVideoToCanvas(canvas, mirror = true, fallbackWidth = 220, fallbackHeight = 150) {
  if (!canvas || !video || !video.elt) return;
  const source = video.elt;
  if (source.readyState < 2 && !source.videoWidth) return;

  const rect = canvas.getBoundingClientRect();
  const targetWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || canvas.width || fallbackWidth));
  const targetHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || canvas.height || fallbackHeight));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  try {
    const sourceWidth = source.videoWidth || source.width || 640;
    const sourceHeight = source.videoHeight || source.height || 480;
    const sourceAspect = sourceWidth / sourceHeight;
    const canvasAspect = canvas.width / canvas.height;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceAspect > canvasAspect) {
      sw = sourceHeight * canvasAspect;
      sx = (sourceWidth - sw) / 2;
    } else if (sourceAspect < canvasAspect) {
      sh = sourceWidth / canvasAspect;
      sy = (sourceHeight - sh) / 2;
    }

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    // The camera may not have produced a frame yet.
  }
  ctx.restore();
}

function initGameCameraPreview() {
  gameCameraCanvas = $("gameCameraCanvas");
  gameCameraCtx = gameCameraCanvas ? gameCameraCanvas.getContext("2d") : null;
}

function updateGameCameraPreview() {
  if (currentScreen !== "lubanGame") return;
  if (!gameCameraCanvas || !gameCameraCtx) initGameCameraPreview();
  drawVideoToCanvas(gameCameraCanvas, mirrorInteraction, 224, 126);
}

function updateLubanCameraPreview() {
  updateGameCameraPreview();
}

function initBuildingCameraPreview() {
  buildingCameraCanvas = $("buildingCameraCanvas");
  buildingCameraCtx = buildingCameraCanvas ? buildingCameraCanvas.getContext("2d") : null;
}

function updateBuildingCameraPreview() {
  if (currentScreen !== "building") return;
  if (!buildingCameraCanvas || !buildingCameraCtx) initBuildingCameraPreview();
  drawVideoToCanvas(buildingCameraCanvas, true, 220, 150);
}

function initBuildingSceneIfNeeded() {
  if (buildingInitialized || !window.THREE) return;

  const canvas = $("buildingCanvas");
  if (!canvas) return;
  initBuildingCameraPreview();

  buildingThreeScene = new THREE.Scene();
  buildingCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  buildingCamera.position.set(0, 2.1, 7.2);
  buildingCamera.lookAt(0, 1.2, 0);

  buildingRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  buildingRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding) buildingRenderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) buildingRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  buildingRenderer.toneMappingExposure = 0.82;

  buildingThreeScene.add(new THREE.AmbientLight(0xffffff, 0.38));
  buildingThreeScene.add(new THREE.HemisphereLight(0xffefd2, 0x25170d, 0.68));

  const key = new THREE.DirectionalLight(0xffdfad, 1.02);
  key.position.set(4, 6, 5);
  buildingThreeScene.add(key);

  const side = new THREE.DirectionalLight(0xffc88f, 0.42);
  side.position.set(-5, 2.8, 3.4);
  buildingThreeScene.add(side);

  const rim = new THREE.DirectionalLight(0xcaa06e, 0.28);
  rim.position.set(0, 3.5, -5);
  buildingThreeScene.add(rim);

  buildingLoader = new THREE.GLTFLoader();
  buildingRaycaster = new THREE.Raycaster();
  buildingGroup = new THREE.Group();
  fullBuildingGroup = new THREE.Group();
  buildingPartsGroup = new THREE.Group();
  buildingPartsGroup.visible = false;
  buildingGroup.add(fullBuildingGroup, buildingPartsGroup);
  buildingThreeScene.add(buildingGroup);

  loadBuildingFullModel();
  loadBuildingParts();
  loadBuildingExplodeTargets();
  window.addEventListener("resize", resizeBuildingScene);
  buildingInitialized = true;
  resizeBuildingScene();
  animateBuildingScene();
}

function initBuildingScene() {
  initBuildingSceneIfNeeded();
}

function loadBuildingFullModel() {
  if (!buildingLoader || !fullBuildingGroup) return;

  buildingLoader.load(
    "./models/building/building_full.glb",
    (gltf) => {
      buildingFullModel = gltf.scene;
      prepareBuildingObject(buildingFullModel);
      fullBuildingGroup.add(buildingFullModel);
      buildingFullLoaded = true;
      updateBuildingModelVisibility();
      hideBuildingPlaceholderIfReady();
      centerBuildingGroup();
      console.log("[building] loaded building_full.glb");
    },
    undefined,
    (err) => {
      console.warn("[building] failed to load building_full.glb", err);
    }
  );
}

function loadBuildingParts() {
  if (!buildingLoader || !buildingPartsGroup) return;

  buildingPartFiles.forEach((file) => {
    const key = getBuildingPartKey(file);
    buildingLoader.load(
      `./models/building/${file}`,
      (gltf) => {
        const object = gltf.scene;
        prepareBuildingObject(object);
        object.userData.buildingPartKey = key;
        object.traverse((child) => {
          if (child.isMesh) child.userData.buildingPartKey = key;
        });
        buildingPartsGroup.add(object);

        object.updateMatrixWorld(true);
        const originalBox = new THREE.Box3().setFromObject(object);

        const part = {
          object,
          key,
          file,
          originalPosition: object.position.clone(),
          originalRotation: object.rotation.clone(),
          originalQuaternion: object.quaternion.clone(),
          originalScale: object.scale.clone(),
          partCenter: new THREE.Vector3(),
          explodePosition: object.position.clone(),
          explodeRotation: object.rotation.clone(),
          explodeQuaternion: object.quaternion.clone(),
          explodeScale: object.scale.clone(),
        };

        originalBox.getCenter(part.partCenter);
        object.visible = false;
        buildingParts.push(part);
        applyBuildingExplodeTargetForKey(key);

        buildingPartsLoaded++;
        if (buildingPartsLoaded === buildingPartFiles.length) {
          hideBuildingPlaceholderIfReady();
          centerBuildingGroup();
          updateBuildingModelVisibility();
        }
        console.log(`[building] loaded ${file}`);
      },
      undefined,
      (err) => {
        console.warn(`[building] failed to load ${file}`, err);
      }
    );
  });
}

function loadBuildingExplodeTargets() {
  if (!buildingLoader) return;

  buildingPartFiles.forEach((file) => {
    const key = getBuildingPartKey(file);
    const explodeFile = `building_explode_${key}.glb`;

    buildingLoader.load(
      `./models/building_explode/${explodeFile}`,
      (gltf) => {
        const object = gltf.scene;
        prepareBuildingObject(object);
        object.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        box.getCenter(center);

        buildingExplodeTargets.set(key, {
          file: explodeFile,
          object,
          center,
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
        });

        buildingExplodeTargetsLoaded++;
        applyBuildingExplodeTargetForKey(key);
        console.log(`[building] loaded ${explodeFile} as explode target`);
      },
      undefined,
      (err) => {
        console.warn(`[building] failed to load ${explodeFile}`, err);
      }
    );
  });
}

function getBuildingPartKey(file) {
  const match = file.match(/(\d{2})/);
  return match ? match[1] : file;
}

function prepareBuildingObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      if ("side" in mat) mat.side = THREE.DoubleSide;
      if ("emissiveIntensity" in mat) mat.emissiveIntensity = Math.min(mat.emissiveIntensity || 0, 0.04);
      if (mat.emissive && mat.emissive.isColor) mat.emissive.multiplyScalar(0.35);
    });
  });
}

function hideBuildingPlaceholderIfReady() {
  if (!buildingFullLoaded && buildingPartsLoaded < buildingPartFiles.length) return;
  const placeholder = $("buildingStage")?.querySelector(".building-placeholder");
  if (placeholder) placeholder.classList.add("is-hidden");
}

function centerBuildingGroup() {
  if (!buildingGroup || buildingCentered) return;
  if (!buildingFullLoaded || buildingPartsLoaded < buildingPartFiles.length) return;

  buildingGroup.position.set(0, 0, 0);
  buildingGroup.scale.set(1, 1, 1);
  buildingGroup.rotation.set(0, 0, 0);

  const box = new THREE.Box3().setFromObject(buildingGroup);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxSize) || maxSize <= 0) return;

  const targetSize = 4.6;
  const scale = targetSize / maxSize;
  const targetCenter = new THREE.Vector3(0, 1.15, 0);

  buildingGroup.scale.setScalar(scale);
  buildingGroup.position.copy(targetCenter).sub(center.multiplyScalar(scale));
  buildingBaseScale = scale;
  const cameraDistance = THREE.MathUtils.clamp(maxSize * scale * 1.75, 5.8, 9.2);
  buildingCamera.position.set(0, targetCenter.y + 0.9, cameraDistance);
  buildingCamera.lookAt(targetCenter);
  buildingCentered = true;
}

function applyBuildingExplodeTargetForKey(key) {
  const part = buildingParts.find((entry) => entry.key === key);
  const target = buildingExplodeTargets.get(key);
  if (!part || !target) return;

  const centerDelta = target.center.clone().sub(part.partCenter);
  part.explodePosition.copy(part.originalPosition).add(centerDelta);
  part.explodeRotation.copy(target.rotation);
  part.explodeQuaternion.copy(target.quaternion);
  part.explodeScale.copy(target.scale);
}

function updateBuildingGesture() {
  if (buildingPartViewerActive) return;
  if (currentScreen !== "building" || !hands || hands.length === 0) return;

  const state = getFingerState(hands[0]);
  if (isFistGesture(state)) {
    buildingExplodeTarget = 0;
  } else if (state.known >= 4 && state.extended >= 4) {
    buildingExplodeTarget = 1;
  }
}

function updateBuildingExplodeAnimation() {
  if (!buildingParts.length) return;

  buildingExplodeProgress = THREE.MathUtils.lerp(
    buildingExplodeProgress,
    buildingExplodeTarget,
    0.045
  );
  const eased = easeInOutCubic(buildingExplodeProgress);

  buildingParts.forEach((part) => {
    part.object.position.lerpVectors(
      part.originalPosition,
      part.explodePosition,
      eased
    );
    part.object.quaternion.slerpQuaternions(
      part.originalQuaternion,
      part.explodeQuaternion,
      eased
    );
    part.object.scale.lerpVectors(
      part.originalScale,
      part.explodeScale,
      eased
    );
  });

  if (buildingPartsGroup) {
    const targetScale = THREE.MathUtils.lerp(
      BUILDING_NORMAL_SCALE,
      BUILDING_EXPLODE_SCALE,
      eased
    );
    buildingPartsGroup.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.08
    );
  }

  updateBuildingModelVisibility();
}

function easeInOutCubic(t) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function updateBuildingModelVisibility() {
  const exploded = buildingExplodeProgress > 0.05 || buildingExplodeTarget > 0.05;

  if (fullBuildingGroup) fullBuildingGroup.visible = !exploded;
  if (buildingPartsGroup) buildingPartsGroup.visible = exploded;

  buildingParts.forEach((part) => {
    part.object.visible = exploded;
  });
}

function updateBuildingInteraction() {
  updateBuildingCursor();
  updateBuildingGesture();
  updateBuildingExplodeAnimation();
  updateBuildingHoverSelection();
  updateLubanEntryDwell();
}

function updateCoverInteraction() {
  updateCoverCursor();
  updateCoverEnterDwell();
}

function updateCoverCursor() {
  const cursorEl = $("coverCursor");
  const cover = $("coverScreen");
  if (!cursorEl || !cover || currentScreen !== "cover" || !cursor.visible) {
    coverCursorState.visible = false;
    if (cursorEl) cursorEl.classList.add("is-hidden");
    return;
  }

  const rect = cover.getBoundingClientRect();
  const clientX = rect.left + cursor.x * rect.width;
  const clientY = rect.top + cursor.y * rect.height;
  const nx = cursor.x;
  const ny = cursor.y;
  coverCursorState = { visible: true, x: nx, y: ny, clientX, clientY };
  cursorEl.classList.remove("is-hidden");
  cursorEl.style.left = `${clientX}px`;
  cursorEl.style.top = `${clientY}px`;
}

function isPointInElement(clientX, clientY, el, padding = 0) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return (
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding
  );
}

function updateCoverEnterDwell() {
  const enterBtn = $("enterSystemBtn");
  const cursorEl = $("coverCursor");
  if (currentScreen !== "cover" || !enterBtn || !coverCursorState.visible) {
    resetCoverDwell();
    return;
  }

  const over = isPointInElement(
    coverCursorState.clientX,
    coverCursorState.clientY,
    enterBtn,
    COVER_ENTER_HIT_PADDING
  );
  if (!over) {
    resetCoverDwell();
    return;
  }

  if (!coverEnterHoverStart) coverEnterHoverStart = performance.now();
  const progress = (performance.now() - coverEnterHoverStart) / DWELL_TIME;
  enterBtn.classList.add("is-dwelling");
  enterBtn.style.setProperty("--progress", String(THREE.MathUtils.clamp(progress, 0, 1)));
  if (cursorEl) cursorEl.style.setProperty("--progress", String(THREE.MathUtils.clamp(progress, 0, 1)));

  if (progress >= 1) triggerEnterSystem();
}

function resetCoverDwell() {
  coverEnterHoverStart = 0;
  const enterBtn = $("enterSystemBtn");
  const cursorEl = $("coverCursor");
  if (enterBtn) {
    enterBtn.classList.remove("is-dwelling");
    enterBtn.style.setProperty("--progress", "0");
  }
  if (cursorEl) cursorEl.style.setProperty("--progress", "0");
}

function updateLubanButtonDwell() {
  if (currentScreen !== "lubanGame" || !cursor.visible) {
    resetLubanButtonDwell();
    return;
  }

  const target = getHoveredLubanButton();
  if (!target) {
    resetLubanButtonDwell();
    return;
  }

  if (target === lubanButtonTriggeredTarget) return;

  if (target !== lubanButtonHoverTarget) {
    resetLubanButtonDwell();
    lubanButtonHoverTarget = target;
    lubanButtonHoverStart = performance.now();
  }

  const progress = (performance.now() - lubanButtonHoverStart) / DWELL_TIME;
  lubanButtonDwellProgress = THREE.MathUtils.clamp(progress, 0, 1);
  target.classList.add("is-dwelling");
  target.style.setProperty("--progress", String(lubanButtonDwellProgress));

  if (progress >= 1) {
    lubanButtonTriggeredTarget = target;
    target.classList.remove("is-dwelling");
    target.style.setProperty("--progress", "0");
    triggerLubanDwellButton(target);
  }
}

function triggerLubanDwellButton(target) {
  if (!target) return;
  if (target.id === "modelViewerCloseBtn") {
    closeModelViewer();
    return;
  }
  if (target.classList.contains("viewer-model-btn")) {
    const key = target.dataset.modelKey;
    if (key) switchViewerModel(key);
    return;
  }
  if (target.id === "helpBtn") {
    $("helpPanel")?.classList.toggle("is-hidden");
    return;
  }
  if (target.id === "helpCloseBtn") {
    $("helpPanel")?.classList.add("is-hidden");
    return;
  }
  target.click();
}

function getHoveredLubanButton() {
  const clientX = cursor.x * window.innerWidth;
  const clientY = cursor.y * window.innerHeight;

  const modelViewerClose = getHoveredModelViewerCloseButton(clientX, clientY);
  if (modelViewerClose) return modelViewerClose;

  const selectors = [
    "#backToBuildingBtn",
    "#startBtn",
    "#musicBtn",
    "#modelViewBtn",
    "#autoBtn",
    "#resetBtn",
    "#mirrorBtn",
    "#helpBtn",
    "#helpCloseBtn",
    ".viewer-model-btn",
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (!isUsableDwellButton(el)) continue;
      if (isPointInElement(clientX, clientY, el, LUBAN_BUTTON_HIT_PADDING)) return el;
    }
  }

  return null;
}

function getHoveredModelViewerCloseButton(clientX, clientY) {
  const overlay = $("modelViewerOverlay");
  const closeBtn = $("modelViewerCloseBtn");
  if (!overlay || overlay.classList.contains("is-hidden") || !isUsableDwellButton(closeBtn)) {
    return null;
  }

  if (isPointInElement(clientX, clientY, closeBtn, MODEL_VIEWER_CLOSE_HIT_PADDING)) {
    return closeBtn;
  }

  const panel = document.querySelector(".model-viewer-panel");
  if (!panel) return null;
  const panelRect = panel.getBoundingClientRect();
  const closeZoneSize = 130;
  const inCloseZone =
    clientX >= panelRect.right - closeZoneSize &&
    clientX <= panelRect.right &&
    clientY >= panelRect.top &&
    clientY <= panelRect.top + closeZoneSize;

  return inCloseZone ? closeBtn : null;
}

function isUsableDwellButton(el) {
  if (!el || el.disabled) return false;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  return true;
}

function resetLubanButtonDwell() {
  if (lubanButtonHoverTarget) {
    lubanButtonHoverTarget.classList.remove("is-dwelling");
    lubanButtonHoverTarget.style.setProperty("--progress", "0");
  }
  lubanButtonHoverTarget = null;
  lubanButtonHoverStart = 0;
  lubanButtonTriggeredTarget = null;
  lubanButtonDwellProgress = 0;
}

function updateBuildingCursor() {
  const cursorEl = $("buildingCursor");
  const building = $("buildingScene");
  if (!cursorEl || !building || currentScreen !== "building" || !cursor.visible) {
    buildingCursorState.visible = false;
    if (cursorEl) cursorEl.classList.add("is-hidden");
    return;
  }

  const rect = building.getBoundingClientRect();
  const clientX = rect.left + cursor.x * rect.width;
  const clientY = rect.top + cursor.y * rect.height;
  const nx = cursor.x;
  const ny = cursor.y;

  buildingCursorState = { visible: true, x: nx, y: ny, clientX, clientY };
  cursorEl.classList.remove("is-hidden");
  cursorEl.style.left = `${clientX}px`;
  cursorEl.style.top = `${clientY}px`;
}

function raycastBuildingPartFromCursor() {
  if (!buildingCursorState.visible || !buildingRaycaster || !buildingCamera || !buildingPartsGroup) return null;

  const canvas = $("buildingCanvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const ndc = new THREE.Vector2(
    ((buildingCursorState.clientX - rect.left) / rect.width) * 2 - 1,
    -(((buildingCursorState.clientY - rect.top) / rect.height) * 2 - 1)
  );

  const previousGroupVisible = buildingPartsGroup.visible;
  const previousPartVisibility = buildingParts.map((part) => part.object.visible);
  buildingPartsGroup.visible = true;
  buildingParts.forEach((part) => {
    part.object.visible = true;
  });
  buildingPartsGroup.updateMatrixWorld(true);

  const meshes = [];
  buildingParts.forEach((part) => {
    part.object.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
  });

  buildingRaycaster.setFromCamera(ndc, buildingCamera);
  const hits = buildingRaycaster.intersectObjects(meshes, true);

  buildingPartsGroup.visible = previousGroupVisible;
  buildingParts.forEach((part, index) => {
    part.object.visible = previousPartVisibility[index];
  });

  if (!hits.length) return null;
  const key = hits[0].object.userData.buildingPartKey;
  return buildingParts.find((part) => part.key === key) || null;
}

function updateBuildingHoverSelection() {
  if (!buildingCursorState.visible) {
    resetBuildingHoverProgress();
    return;
  }

  if (buildingPartViewerActive) {
    updateReturnHover();
    return;
  }

  const hitPart = raycastBuildingPartFromCursor();
  const hitKey = hitPart ? hitPart.key : null;

  if (hitKey !== buildingHoverTarget) {
    buildingHoverTarget = hitKey;
    buildingHoverStartTime = hitKey ? performance.now() : 0;
    updateBuildingHoverProgress(0);
  }

  if (!buildingHoverTarget) return;

  const elapsed = performance.now() - buildingHoverStartTime;
  updateBuildingHoverProgress(elapsed / BUILDING_HOVER_DWELL_TIME);

  if (elapsed >= BUILDING_HOVER_DWELL_TIME) {
    openBuildingPartViewer(buildingHoverTarget);
    buildingHoverTarget = null;
    buildingHoverStartTime = 0;
    updateBuildingHoverProgress(0);
  }
}

function updateBuildingHoverProgress(value) {
  const cursorEl = $("buildingCursor");
  if (!cursorEl) return;
  cursorEl.style.setProperty("--progress", String(THREE.MathUtils.clamp(value, 0, 1)));
}

function resetBuildingHoverProgress() {
  buildingHoverTarget = null;
  buildingHoverStartTime = 0;
  returnHoverStartTime = 0;
  updateBuildingHoverProgress(0);
}

function updateLubanEntryDwell() {
  const entry = $("openLubanGameBtn");
  if (!entry || buildingPartViewerActive || !buildingCursorState.visible) {
    resetLubanEntryDwell();
    return;
  }

  const over = isPointInElement(buildingCursorState.clientX, buildingCursorState.clientY, entry);
  if (!over) {
    resetLubanEntryDwell();
    return;
  }

  if (!lubanEntryHoverStart) lubanEntryHoverStart = performance.now();
  const progress = (performance.now() - lubanEntryHoverStart) / DWELL_TIME;
  entry.classList.add("is-dwelling");
  entry.style.setProperty("--progress", String(THREE.MathUtils.clamp(progress, 0, 1)));
  updateBuildingHoverProgress(progress);

  if (progress >= 1) triggerOpenLubanGame();
}

function resetLubanEntryDwell() {
  lubanEntryHoverStart = 0;
  const entry = $("openLubanGameBtn");
  if (entry) {
    entry.classList.remove("is-dwelling");
    entry.style.setProperty("--progress", "0");
  }
}

function isCursorInReturnZone() {
  if (!buildingCursorState.visible) return false;
  const zone = $("buildingPartViewerBackZone");
  if (!zone) return false;
  const rect = zone.getBoundingClientRect();
  return (
    buildingCursorState.clientX >= rect.left &&
    buildingCursorState.clientX <= rect.right &&
    buildingCursorState.clientY >= rect.top &&
    buildingCursorState.clientY <= rect.bottom
  );
}

function updateReturnHover() {
  const backZone = $("buildingPartViewerBackZone");
  if (!isCursorInReturnZone()) {
    returnHoverStartTime = 0;
    updateBuildingHoverProgress(0);
    if (backZone) backZone.classList.remove("is-hovering");
    return;
  }

  if (!returnHoverStartTime) returnHoverStartTime = performance.now();
  const elapsed = performance.now() - returnHoverStartTime;
  updateBuildingHoverProgress(elapsed / BUILDING_HOVER_DWELL_TIME);
  if (backZone) backZone.classList.add("is-hovering");

  if (elapsed >= BUILDING_HOVER_DWELL_TIME) {
    closeBuildingPartViewer();
    returnHoverStartTime = 0;
    updateBuildingHoverProgress(0);
  }
}

function openBuildingPartViewer(partKey) {
  buildingPartViewerActive = true;
  const building = $("buildingScene");
  const overlay = $("buildingPartViewer");
  const title = $("buildingPartViewerTitle");
  const body = $("buildingPartViewerBody");
  const hint = $("buildingPartViewerHint");
  const fullKey = `building_${partKey}`;
  const description = getBuildingPartDescription(fullKey);
  if (building) building.classList.add("viewer-open");
  if (overlay) overlay.dataset.partKey = fullKey;
  if (overlay) overlay.classList.remove("hidden");
  if (title) title.textContent = description.title;
  if (body) body.textContent = description.body;
  if (hint) hint.innerHTML = t("buildingViewerHint");
  initBuildingPartViewer();
  resizeBuildingPartViewer();
  loadBuildingPartViewerModel(partKey);
}

function closeBuildingPartViewer() {
  const building = $("buildingScene");
  const overlay = $("buildingPartViewer");
  if (overlay) overlay.classList.add("hidden");
  if (building) building.classList.remove("viewer-open");
  buildingPartViewerActive = false;
  returnHoverStartTime = 0;
  resetBuildingHoverProgress();
}

function initBuildingPartViewer() {
  if (buildingPartViewerInitialized) return;

  const canvas = $("buildingPartViewerCanvas");
  if (!canvas || !window.THREE) return;

  buildingPartViewerScene = new THREE.Scene();
  buildingPartViewerCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  buildingPartViewerCamera.position.set(0, 0.25, 5.2);
  buildingPartViewerCamera.lookAt(0, 0, 0);

  buildingPartViewerRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  buildingPartViewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding) buildingPartViewerRenderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) buildingPartViewerRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  buildingPartViewerRenderer.toneMappingExposure = 0.82;

  buildingPartViewerScene.add(new THREE.AmbientLight(0xffffff, 0.44));
  buildingPartViewerScene.add(new THREE.HemisphereLight(0xffefd2, 0x1b120a, 0.85));

  const key = new THREE.DirectionalLight(0xffdfad, 1.15);
  key.position.set(3, 5, 4);
  buildingPartViewerScene.add(key);

  buildingPartViewerGroup = new THREE.Group();
  buildingPartViewerScene.add(buildingPartViewerGroup);

  const backZone = $("buildingPartViewerBackZone");
  if (backZone) backZone.addEventListener("click", closeBuildingPartViewer);

  window.addEventListener("resize", resizeBuildingPartViewer);
  buildingPartViewerInitialized = true;
  resizeBuildingPartViewer();
  animateBuildingPartViewer();
}

function loadBuildingPartViewerModel(partKey) {
  if (!buildingLoader || !buildingPartViewerGroup) return;

  disposeBuildingPartViewerModel();
  const token = ++buildingPartViewerLoadToken;
  const file = `building_${partKey}.glb`;

  buildingLoader.load(
    `./models/building/${file}`,
    (gltf) => {
      if (token !== buildingPartViewerLoadToken) return;
      buildingPartViewerModel = gltf.scene;
      prepareBuildingObject(buildingPartViewerModel);
      buildingPartViewerGroup.rotation.set(-0.12, 0, 0);
      buildingPartViewerGroup.add(buildingPartViewerModel);
      centerBuildingPartViewerModel();
      console.log(`[building viewer] loaded ${file}`);
    },
    undefined,
    (err) => {
      console.warn(`[building viewer] failed to load ${file}`, err);
    }
  );
}

function disposeBuildingPartViewerModel() {
  if (!buildingPartViewerModel || !buildingPartViewerGroup) return;
  buildingPartViewerGroup.remove(buildingPartViewerModel);
  buildingPartViewerModel.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => mat && mat.dispose && mat.dispose());
  });
  buildingPartViewerModel = null;
}

function centerBuildingPartViewerModel() {
  if (!buildingPartViewerModel) return;

  buildingPartViewerModel.position.set(0, 0, 0);
  buildingPartViewerModel.scale.set(1, 1, 1);

  const box = new THREE.Box3().setFromObject(buildingPartViewerModel);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  buildingPartViewerModel.position.sub(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize > 0) {
    buildingPartViewerModel.scale.multiplyScalar(2.7 / maxSize);
  }

  const fittedBox = new THREE.Box3().setFromObject(buildingPartViewerModel);
  const fittedCenter = new THREE.Vector3();
  fittedBox.getCenter(fittedCenter);
  buildingPartViewerModel.position.sub(fittedCenter);
}

function resizeBuildingPartViewer() {
  if (!buildingPartViewerRenderer || !buildingPartViewerCamera) return;
  const canvas = $("buildingPartViewerCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  buildingPartViewerCamera.aspect = rect.width / rect.height;
  buildingPartViewerCamera.updateProjectionMatrix();
  buildingPartViewerRenderer.setSize(rect.width, rect.height, false);
}

function animateBuildingPartViewer() {
  requestAnimationFrame(animateBuildingPartViewer);
  if (!buildingPartViewerRenderer || !buildingPartViewerScene || !buildingPartViewerCamera) return;
  if (buildingPartViewerActive && buildingPartViewerGroup) {
    if (buildingCursorState.visible) {
      const targetRotY = (buildingCursorState.x - 0.5) * Math.PI * 1.6;
      const targetRotX = -0.12 + (buildingCursorState.y - 0.5) * Math.PI * 0.45;
      buildingPartViewerGroup.rotation.y = THREE.MathUtils.lerp(
        buildingPartViewerGroup.rotation.y,
        targetRotY,
        0.08
      );
      buildingPartViewerGroup.rotation.x = THREE.MathUtils.lerp(
        buildingPartViewerGroup.rotation.x,
        targetRotX,
        0.08
      );
    } else {
      buildingPartViewerGroup.rotation.y += 0.006;
    }
  }
  buildingPartViewerRenderer.render(buildingPartViewerScene, buildingPartViewerCamera);
}

function resizeBuildingScene() {
  if (!buildingRenderer || !buildingCamera) return;
  const canvas = $("buildingCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  buildingCamera.aspect = rect.width / rect.height;
  buildingCamera.updateProjectionMatrix();
  buildingRenderer.setSize(rect.width, rect.height, false);
}

function animateBuildingScene() {
  requestAnimationFrame(animateBuildingScene);
  if (!buildingRenderer || !buildingThreeScene || !buildingCamera) return;
  if (buildingGroup && currentScreen === "building") {
    buildingGroup.rotation.y += 0.003;
    updateBuildingCameraPreview();
  }
  buildingRenderer.render(buildingThreeScene, buildingCamera);
}

function openModelViewer() {
  const overlay = $("modelViewerOverlay");
  if (!overlay) return;
  overlay.classList.remove("is-hidden");
  viewerAnimationActive = true;
  initModelViewer();
  switchViewerModel(currentViewerModelKey || "luban_a");
  resizeModelViewer();
}

function closeModelViewer() {
  const overlay = $("modelViewerOverlay");
  if (overlay) overlay.classList.add("is-hidden");
  viewerAnimationActive = false;
}

function initModelViewer() {
  if (viewerInitialized) return;

  const canvas = $("modelViewerCanvas");
  if (!canvas || !window.THREE) return;

  viewerScene = new THREE.Scene();
  viewerCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  viewerCamera.position.set(0, 0, 5.4);
  viewerCamera.lookAt(0, 0, 0);

  viewerRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  viewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding) viewerRenderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) viewerRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewerRenderer.toneMappingExposure = 0.98;

  viewerScene.add(new THREE.AmbientLight(0xffffff, 0.55));
  viewerScene.add(new THREE.HemisphereLight(0xffefd2, 0x23160d, 1.25));

  const key = new THREE.DirectionalLight(0xffdfad, 2.1);
  key.position.set(3, 5, 4);
  viewerScene.add(key);

  const fill = new THREE.PointLight(0xffc477, 1.1, 10);
  fill.position.set(-3, 2.6, 3);
  viewerScene.add(fill);

  viewerGroup = new THREE.Group();
  viewerGroup.position.set(0, 0, 0);
  viewerScene.add(viewerGroup);

  window.addEventListener("resize", resizeModelViewer);
  viewerInitialized = true;
  resizeModelViewer();
  animateModelViewer();
}

function switchViewerModel(modelKey) {
  currentViewerModelKey = modelKey;
  document.querySelectorAll(".viewer-model-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.modelKey === modelKey);
  });

  const name = $("viewerModelName");
  if (name) name.textContent = modelKey;

  if (!viewerInitialized) return;
  loadViewerModel(modelKey);
}

function loadViewerModel(modelKey) {
  if (!loader || !viewerGroup) return;

  const file = viewerModelFiles[modelKey];
  if (!file) return;

  viewerLoading = true;
  const loadToken = ++viewerLoadToken;
  disposeViewerModel();

  loader.load(
    `./models/luban_viewer/${file}`,
    (gltf) => {
      if (loadToken !== viewerLoadToken) return;
      viewerModel = gltf.scene;
      brightenObjectMaterials(viewerModel);
      viewerModel.rotation.set(0, 0, Math.PI / 2);
      viewerGroup.rotation.set(-0.12, 0, 0);
      viewerGroup.position.set(0, 0, 0);
      viewerGroup.add(viewerModel);
      centerViewerModel();
      viewerLoading = false;
      log(`viewer loaded ${file}`);
    },
    undefined,
    (err) => {
      if (loadToken !== viewerLoadToken) return;
      viewerLoading = false;
      log(`viewer failed ${file}: ${err?.message || err}`);
    }
  );
}

function disposeViewerModel() {
  if (!viewerModel || !viewerGroup) return;
  viewerGroup.remove(viewerModel);
  viewerModel.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (mat && mat.dispose) mat.dispose();
    });
  });
  viewerModel = null;
}

function centerViewerModel() {
  if (!viewerModel) return;

  viewerModel.position.set(0, 0, 0);
  viewerModel.scale.set(1, 1, 1);

  const box = new THREE.Box3().setFromObject(viewerModel);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  viewerModel.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 2.7 / maxDim : 1;
  viewerModel.scale.multiplyScalar(scale);

  const fittedBox = new THREE.Box3().setFromObject(viewerModel);
  const fittedCenter = new THREE.Vector3();
  fittedBox.getCenter(fittedCenter);
  viewerModel.position.sub(fittedCenter);
}

function resizeModelViewer() {
  if (!viewerRenderer || !viewerCamera) return;
  const canvas = $("modelViewerCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  viewerCamera.aspect = rect.width / rect.height;
  viewerCamera.updateProjectionMatrix();
  viewerRenderer.setSize(rect.width, rect.height, false);
}

function animateModelViewer() {
  requestAnimationFrame(animateModelViewer);
  if (!viewerRenderer || !viewerScene || !viewerCamera) return;
  if (viewerAnimationActive && viewerGroup) {
    viewerGroup.rotation.y += 0.01;
  }
  viewerRenderer.render(viewerScene, viewerCamera);
}

function initThree() {
  if (!window.THREE) {
    log("ERROR: THREE is not loaded.");
    return;
  }

  const canvas = $("canvas3d");
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0907, 10, 22);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 2.72, 8.9);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;

  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  scene.add(new THREE.HemisphereLight(0xffefd2, 0x2a1b12, 1.12));

  const key = new THREE.DirectionalLight(0xffdfad, 2.25);
  key.position.set(4, 7, 4);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.PointLight(0xffc477, 1.45, 14);
  fill.position.set(-4, 3.5, 4);
  scene.add(fill);

  const front = new THREE.PointLight(0xffffff, 0.55, 10);
  front.position.set(0, 2.5, 5);
  scene.add(front);

  lubanGroup = new THREE.Group();
  targetGroup = new THREE.Group();
  scene.add(targetGroup);
  scene.add(lubanGroup);

  loader = new THREE.GLTFLoader();
  raycaster = new THREE.Raycaster();
  dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.15);

  window.addEventListener("resize", resizeThree);
  resizeThree();

  $("modelStatus").textContent = "Three.js 준비됨";
  log("Three.js ready");
}

function resizeThree() {
  if (!renderer || !camera) return;
  const canvas = $("canvas3d");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}

function loadModels() {
  if (!loader) return;
  let loadedCount = 0;
  let failedCount = 0;

  modelFiles.forEach((cfg) => {
    const url = `./models/luban_lock/${cfg.file}`;
    loader.load(
      url,
      (gltf) => {
        const obj = gltf.scene;
        scaleObjectPreserveOrigin(obj, UNIT_SCALE);
        obj.position.set(...cfg.start);
        obj.rotation.set(...cfg.startRot);

        brightenObjectMaterials(obj);

        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.userData.pieceKey = cfg.key;
          }
        });

        lubanGroup.add(obj);
        const piece = {
          object: obj,
          key: cfg.key,
          start: new THREE.Vector3(...cfg.start),
          target: new THREE.Vector3(...cfg.target),
          targetRot: new THREE.Euler(...cfg.targetRot),
          baseRotation: new THREE.Euler(...cfg.startRot),
          snapped: false,
          locked: false,
          bbox: new THREE.Box3(),
        };
        pieces.push(piece);

        // Fallback white transparent ghost from the same piece.
        createFallbackTargetGhost(piece, cfg);

        loadedCount++;
        $("modelStatus").textContent = `모델 로드 ${loadedCount}/6`;
        log(`loaded ${cfg.file}`);
      },
      undefined,
      (err) => {
        failedCount++;
        log(`FAILED ${cfg.file}: ${err?.message || err}`);
        $("modelStatus").textContent = `로드 실패 ${failedCount}`;
        if (loadedCount === 0 && failedCount === modelFiles.length) createFallbackBlocks();
      }
    );
  });

  loadTargetReferenceModels();
}

function loadTargetReferenceModels() {
  // Current project uses the active luban_a-f clones as single-piece step ghosts.
  // The full final target is kept supported as a file check, but it is never shown.
  // Step guidance must use single-piece ghostTargets so completed wooden pieces are not covered.
  loader.load(
    "./models/luban_target/target_full.glb",
    (gltf) => {
      const obj = gltf.scene;
      scaleObjectPreserveOrigin(obj, UNIT_SCALE);
      obj.position.copy(TARGET_ORIGIN);
      obj.visible = false;
      targetGroup.add(obj);
      stepModels.push({ key: "target_full", object: obj, file: "target_full.glb" });
      log("loaded target_full.glb and kept hidden; single-piece ghosts drive step display");
    },
    undefined,
    () => {
      log("target_full.glb not found or not needed");
    }
  );
}

function loadPerPieceTargetModels() {
  // Optional per-piece target models remain supported.
  modelFiles.forEach((cfg) => {
    loader.load(
      `./models/luban_target/${cfg.targetFile}`,
      (gltf) => {
        const obj = gltf.scene;
        scaleObjectPreserveOrigin(obj, UNIT_SCALE);
        obj.position.copy(TARGET_ORIGIN);
        obj.rotation.set(...cfg.targetRot);
        applyGhostMaterial(obj, 0.24);
        obj.visible = false;
        registerGhostTarget(cfg.key, obj, "target-file");
        log(`loaded ${cfg.targetFile} as piece target ghost`);
      },
      undefined,
      () => {}
    );
  });
}

function createFallbackTargetGhost(piece, cfg) {
  const ghost = piece.object.clone(true);
  ghost.position.copy(TARGET_ORIGIN);
  ghost.rotation.set(piece.targetRot.x, piece.targetRot.y, piece.targetRot.z);
  applyGhostMaterial(ghost, 0.24);
  ghost.visible = false;
  registerGhostTarget(cfg.key, ghost, "piece-clone");
  updateStepUI();
}

function registerGhostTarget(key, object, source) {
  const existingIndex = ghostTargets.findIndex((entry) => entry.key === key);

  if (existingIndex >= 0) {
    const existing = ghostTargets[existingIndex];
    if (existing.source === "target-file" && source !== "target-file") return;
    if (existing.object && existing.object.parent) existing.object.parent.remove(existing.object);
    ghostTargets.splice(existingIndex, 1);
  }

  object.userData.ghostTargetKey = key;
  object.userData.ghostTargetSource = source;
  object.visible = false;
  targetGroup.add(object);
  ghostTargets.push({ key, object, source });
  sortGhostTargets();
  updateStepDisplay();
}

function sortGhostTargets() {
  ghostTargets.sort((a, b) => STEP_ORDER.indexOf(a.key) - STEP_ORDER.indexOf(b.key));
}

function applyGhostMaterial(obj, opacity) {
  obj.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.isGhostTarget = true;
    child.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      roughness: 0.18,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveIntensity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

function brightenObjectMaterials(obj) {
  obj.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    if (child.userData.lockedMaterialApplied && child.userData.unlockedMaterial) {
      child.material = child.userData.unlockedMaterial;
      child.userData.lockedMaterialApplied = false;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      mat.needsUpdate = true;

      if (mat.color && mat.color.multiplyScalar) {
        mat.color.multiplyScalar(1.03);
      }

      if ("roughness" in mat) mat.roughness = Math.max(0.50, mat.roughness * 0.96);
      if ("metalness" in mat) mat.metalness = Math.min(0.08, mat.metalness || 0);

      if ("emissive" in mat && mat.emissive) {
        mat.emissive.setRGB(0.018, 0.012, 0.006);
        mat.emissiveIntensity = 0.08;
      }
    });
  });
}

function normalizeObject(obj, targetSize) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) obj.scale.multiplyScalar(targetSize / maxDim);

  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.sub(center);
}

function scaleObjectPreserveOrigin(obj, unitScale = UNIT_SCALE) {
  obj.scale.setScalar(unitScale);
}

function scaleObjectToUnitAndCenter(obj, unitScale = UNIT_SCALE) {
  // Use the same scale for all GLB files exported from the same coordinate system.
  // This keeps single blocks, step models and target_full in matching sizes.
  obj.scale.setScalar(unitScale);
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.sub(center);
}

function createFallbackBlocks() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd69a54, roughness: 0.52, emissive: 0x1f1207, emissiveIntensity: 0.07 });
  modelFiles.forEach((cfg) => {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.34, 0.34), mat);
    obj.position.set(...cfg.start);
    obj.rotation.set(...cfg.startRot);
    obj.castShadow = true;
    obj.receiveShadow = true;
    lubanGroup.add(obj);

    const piece = {
      object: obj,
      key: cfg.key,
      start: new THREE.Vector3(...cfg.start),
      target: new THREE.Vector3(...cfg.target),
      targetRot: new THREE.Euler(...cfg.targetRot),
      baseRotation: new THREE.Euler(...cfg.startRot),
      snapped: false,
      locked: false,
      bbox: new THREE.Box3(),
    };
    pieces.push(piece);
    createFallbackTargetGhost(piece, cfg);
  });
  log("using fallback blocks");
}

function cursorToNDC() {
  const stage = $("stage");
  if (stage) {
    const rect = stage.getBoundingClientRect();
    const clientX = cursor.x * window.innerWidth;
    const clientY = cursor.y * window.innerHeight;
    if (rect.width && rect.height) {
      const stageX = THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0, 1);
      const stageY = THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0, 1);
      return new THREE.Vector2(stageX * 2 - 1, -(stageY * 2 - 1));
    }
  }
  return new THREE.Vector2(cursor.x * 2 - 1, -(cursor.y * 2 - 1));
}

function cursorToStageNormalized() {
  const stage = $("stage");
  if (!stage) return { x: cursor.x, y: cursor.y };
  const rect = stage.getBoundingClientRect();
  const clientX = cursor.x * window.innerWidth;
  const clientY = cursor.y * window.innerHeight;
  if (!rect.width || !rect.height) return { x: cursor.x, y: cursor.y };
  return {
    x: THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0, 1),
    y: THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

function setRayFromCursor() {
  if (!raycaster || !camera) return;
  const ndc = cursorToNDC();
  raycaster.setFromCamera(ndc, camera);
}

function updateDragPlaneDepth() {
  dragPlane.constant = -cursor.depthZ;
}


function currentRequiredKey() {
  return STEP_ORDER[currentStepIndex] || null;
}

function updateStepUI() {
  updateStepDisplay();

  const need = currentRequiredKey();
  const stepText = need ? `${t("step")} ${currentStepIndex + 1}/6 · ${t("needBlock")} ${need}` : t("complete");
  const badge = $("stepBadge");
  if (badge) badge.textContent = need ? `${t("step")} ${currentStepIndex + 1} / 6` : t("complete");
  const el = $("selectedStatus");
  if (el && !selected) el.textContent = stepText;
}

function updateStepDisplay() {
  const need = currentRequiredKey();

  ghostTargets.forEach((entry) => {
    if (!entry || !entry.object) return;
    entry.object.visible = !!need && entry.key === need;
  });

  stepModels.forEach((entry) => {
    if (!entry || !entry.object) return;
    entry.object.visible = false;
  });
}

function advanceStepIfNeeded(piece) {
  if (!piece || piece.key !== currentRequiredKey()) return;
  hideGhostTarget(piece.key);
  currentStepIndex = Math.min(currentStepIndex + 1, STEP_ORDER.length);
  updateStepUI();
}

function hideGhostTarget(key) {
  ghostTargets.forEach((entry) => {
    if (entry && entry.key === key && entry.object) entry.object.visible = false;
  });
}

function hideAllGhostTargets() {
  ghostTargets.forEach((entry) => {
    if (entry && entry.object) entry.object.visible = false;
  });
}

function showFinalIntro() {
  const panel = $("finalIntroPanel");
  if (panel) panel.classList.add("show");
}

function hideFinalIntro() {
  const panel = $("finalIntroPanel");
  if (panel) panel.classList.remove("show");
}

function handleGestureControl() {
  if (!cursor.visible) {
    if (lastCursorVisible) releaseSelectedPiece(true);
    lastCursorVisible = false;
    return;
  }

  lastCursorVisible = true;

  if (!pieces.length || !raycaster) {
    return;
  }

  if (cursor.gesture === "rotateLeft") {
    releaseSelectedPiece(false);
    lubanGroup.rotation.y += 0.035;
    targetGroup.rotation.y = lubanGroup.rotation.y;
    $("selectedStatus").textContent = "왼쪽 회전";
    return;
  }

  if (cursor.gesture === "rotateRight") {
    releaseSelectedPiece(false);
    lubanGroup.rotation.y -= 0.035;
    targetGroup.rotation.y = lubanGroup.rotation.y;
    $("selectedStatus").textContent = "오른쪽 회전";
    return;
  }

  if (cursor.gesture === "grab") {
    handleFistGrab();
    return;
  }

  releaseSelectedPiece(true);
}


function distanceToTarget(piece) {
  if (!piece) return Infinity;
  return piece.object.position.distanceTo(piece.target);
}

function isInMagnetRange(piece) {
  return distanceToTarget(piece) < MAGNET_DISTANCE;
}

function applyMagnetBuffer(piece) {
  if (!piece || piece.locked) return;

  const d = distanceToTarget(piece);
  if (d >= MAGNET_DISTANCE) {
    if (lastMagnetKey === piece.key) lastMagnetKey = null;
    return;
  }

  if (lastMagnetKey !== piece.key) {
    lastMagnetKey = piece.key;
    playMagnetSound();
    log(`${piece.key} entered magnetic snap area`);
  }

  const t = 1 - THREE.MathUtils.clamp(d / MAGNET_DISTANCE, 0, 1);
  const strength = MAGNET_LERP + t * 0.16;

  piece.object.position.lerp(piece.target, strength);

  piece.object.rotation.x = THREE.MathUtils.lerp(piece.object.rotation.x, piece.targetRot.x, strength * 0.55);
  piece.object.rotation.y = THREE.MathUtils.lerp(piece.object.rotation.y, piece.targetRot.y, strength * 0.55);
  piece.object.rotation.z = THREE.MathUtils.lerp(piece.object.rotation.z, piece.targetRot.z, strength * 0.55);

  $("selectedStatus").textContent = piece.key + " / 흡착 중";
}

function handleFistGrab() {
  if (!selected) {
    selected = pickPiece();
    if (selected) {
      updateDragPlaneDepth();
      const point = intersectDragPlane();
      if (point) dragOffset.copy(selected.object.position).sub(point);
      selectedBaseRot = selected.object.rotation.clone();
      $("selectedStatus").textContent = selected.key;
      log(`selected ${selected.key}`);
    } else {
      $("selectedStatus").textContent = "선택 없음";
    }
  }

  if (selected) {
    if (selected.locked) {
      selected = null;
      $("selectedStatus").textContent = "-";
      return;
    }

    const prevPos = selected.object.position.clone();

    updateDragPlaneDepth();
    const point = intersectDragPlane();
    if (point) {
      const target = point.add(dragOffset);
      clampVector(target);
      selected.object.position.lerp(target, 0.32);
    }

    // After grabbing, rotate the model with the hand angle.
    if (selectedBaseRot) {
      selected.object.rotation.x = selectedBaseRot.x;
      selected.object.rotation.y = selectedBaseRot.y;
      selected.object.rotation.z = selectedBaseRot.z + cursor.handAngle;
    }

    // Buffered magnetic attraction before final snap.
    applyMagnetBuffer(selected);

    // If it is close enough to target, snap and lock immediately.
    if (isCloseEnoughToTarget(selected)) {
      snapAndLockPiece(selected);
      selected = null;
      selectedBaseRot = null;
      return;
    }

    // Simple collision: prevent deep penetration while still allowing contact.
    // Collision is ignored while the object is in magnetic range, so the final snap can complete smoothly.
    if (!isInMagnetRange(selected) && hasCollision(selected)) {
      selected.object.position.lerp(prevPos, 0.75);
      $("selectedStatus").textContent = selected.key + " / 충돌";
    }
  }
}

function releaseSelectedPiece(allowSnap) {
  if (!selected) return;

  if (allowSnap && (isCloseEnoughToTarget(selected) || isInMagnetRange(selected))) {
    snapAndLockPiece(selected);
  } else {
    log(`${selected.key} released`);
  }

  selected = null;
  selectedBaseRot = null;
  $("selectedStatus").textContent = "-";
}

function isCloseEnoughToTarget(piece) {
  if (!piece || piece.locked) return false;
  const d = piece.object.position.distanceTo(piece.target);
  return d < SNAP_DISTANCE;
}

function snapAndLockPiece(piece) {
  if (!piece || piece.locked) return;
  if (piece.key !== currentRequiredKey()) {
    log(`${piece.key} snap blocked; current step needs ${currentRequiredKey()}`);
    return;
  }
  piece.snapped = true;
  piece.locked = true;
  piece.object.position.copy(piece.target);
  piece.object.rotation.set(piece.targetRot.x, piece.targetRot.y, piece.targetRot.z);

  setPieceLockedMaterial(piece.object);

  $("selectedStatus").textContent = piece.key + " / 고정됨";
  lastMagnetKey = null;
  playSnapSound();
  log(`${piece.key} snapped and locked`);
  advanceStepIfNeeded(piece);

  updateGameResult();
}

function setPieceLockedMaterial(obj) {
  obj.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    if (!child.userData.unlockedMaterial) {
      child.userData.unlockedMaterial = child.material;
    }

    const sourceMaterials = Array.isArray(child.userData.unlockedMaterial)
      ? child.userData.unlockedMaterial
      : [child.userData.unlockedMaterial];

    const lockedMaterials = sourceMaterials.map((sourceMat) => {
      const mat = sourceMat && sourceMat.clone ? sourceMat.clone() : sourceMat;
      if (!mat) return;

      mat.transparent = false;
      mat.opacity = 1;
      mat.needsUpdate = true;

      if ("emissive" in mat && mat.emissive) {
        mat.emissive.setRGB(0.055, 0.034, 0.012);
        mat.emissiveIntensity = 0.16;
      }

      if ("roughness" in mat) mat.roughness = Math.max(0.46, mat.roughness);
      if ("metalness" in mat) mat.metalness = Math.min(0.08, mat.metalness || 0);

      return mat;
    });

    child.material = Array.isArray(child.userData.unlockedMaterial)
      ? lockedMaterials
      : lockedMaterials[0];
    child.userData.lockedMaterialApplied = true;
  });
}

function updateGameResult() {
  const lockedCount = pieces.filter((p) => p.locked).length;
  $("modelStatus").textContent = `고정 ${lockedCount}/6`;

  if (lockedCount === 6) {
    gameComplete = true;
    finalDisplayActive = true;
    hideAllGhostTargets();
    showFinalIntro();
    $("selectedStatus").textContent = t("complete");
    log("GAME COMPLETE: final display scale and slow rotation started.");
  } else if (!selected) {
    updateStepUI();
  }
}

function pickPiece() {
  const required = currentRequiredKey();
  if (!required) {
    $("selectedStatus").textContent = t("complete");
    return null;
  }

  setRayFromCursor();

  const meshes = [];
  pieces.forEach((p) => {
    if (p.snapped || p.locked || p.key !== required) return;
    p.object.traverse((child) => {
      if (child.isMesh) {
        child.userData.ownerPiece = p.key;
        meshes.push(child);
      }
    });
  });

  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length) {
    const key = hits[0].object.userData.ownerPiece || hits[0].object.userData.pieceKey;
    return pieces.find((p) => p.key === key && !p.locked && p.key === required);
  }

  const nearest = nearestPieceByScreen(0.30);
  if (nearest && nearest.key === required) return nearest;

  $("selectedStatus").textContent = `${t("step")} ${currentStepIndex + 1}/6 · ${t("needBlock")} ${required}`;
  return null;
}

function nearestPieceByScreen(maxDist) {
  let best = null;
  let bestDist = maxDist;
  const stageCursor = cursorToStageNormalized();

  pieces.forEach((p) => {
    if (p.snapped || p.locked || p.key !== currentRequiredKey()) return;
    const screen = p.object.position.clone().project(camera);
    const sx = (screen.x + 1) / 2;
    const sy = (-screen.y + 1) / 2;
    const d = Math.hypot(sx - stageCursor.x, sy - stageCursor.y);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  });

  return best;
}

function intersectDragPlane() {
  setRayFromCursor();
  const point = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(dragPlane, point);
  return ok ? point : null;
}

function clampVector(v) {
  v.x = THREE.MathUtils.clamp(v.x, BOUNDS.xMin, BOUNDS.xMax);
  v.y = THREE.MathUtils.clamp(v.y, BOUNDS.yMin, BOUNDS.yMax);
  v.z = THREE.MathUtils.clamp(v.z, BOUNDS.zMin, BOUNDS.zMax);
  return v;
}

function pieceBox(piece) {
  const box = new THREE.Box3().setFromObject(piece.object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  size.multiplyScalar(COLLISION_SHRINK);
  size.x = Math.max(0.01, size.x);
  size.y = Math.max(0.01, size.y);
  size.z = Math.max(0.01, size.z);
  return new THREE.Box3().setFromCenterAndSize(center, size);
}

function boxesHaveSolidOverlap(a, b) {
  if (!a.intersectsBox(b)) return false;

  const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);

  return (
    overlapX > COLLISION_MIN_OVERLAP &&
    overlapY > COLLISION_MIN_OVERLAP &&
    overlapZ > COLLISION_MIN_OVERLAP
  );
}

function hasCollision(piece) {
  const a = pieceBox(piece);
  return pieces.some((other) => {
    if (other === piece) return false;
    if (other.locked && piece.locked) return false;
    const b = pieceBox(other);
    return boxesHaveSolidOverlap(a, b);
  });
}

function resetPieces() {
  pieces.forEach((p) => {
    p.snapped = false;
    p.locked = false;
    p.object.position.copy(p.start);
    if (p.baseRotation) {
      p.object.rotation.set(p.baseRotation.x, p.baseRotation.y, p.baseRotation.z);
    }
    brightenObjectMaterials(p.object);
  });
  autoAssembly = false;
  gameComplete = false;
  finalDisplayActive = false;
  selected = null;
  selectedBaseRot = null;
  lastMagnetKey = null;
  currentStepIndex = 0;
  lastCursorVisible = false;
  progressSmooth = 0;
  $("progressBar").style.width = "0%";
  $("selectedStatus").textContent = "-";
  $("modelStatus").textContent = "초기화됨";
  if (lubanGroup) {
    lubanGroup.rotation.set(0, 0, 0);
    lubanGroup.position.set(0, 0, 0);
    lubanGroup.scale.set(1, 1, 1);
  }
  if (targetGroup) targetGroup.rotation.set(0, 0, 0);
  hideFinalIntro();
  updateStepUI();
  log("reset pieces");
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (!renderer || !scene || !camera) return;

  if (currentScreen === "cover") {
    updateCoverVideoFade();
  }

  if (finalDisplayActive && lubanGroup) {
    updateFinalDisplay();
  }

  if (autoAssembly) {
    const required = currentRequiredKey();
    const p = pieces.find((piece) => piece.key === required && !piece.locked);
    if (p) {
      p.object.position.lerp(p.target, 0.035);
      p.object.rotation.x = THREE.MathUtils.lerp(p.object.rotation.x, p.targetRot.x, 0.06);
      p.object.rotation.y = THREE.MathUtils.lerp(p.object.rotation.y, p.targetRot.y, 0.06);
      p.object.rotation.z = THREE.MathUtils.lerp(p.object.rotation.z, p.targetRot.z, 0.06);
      if (p.object.position.distanceTo(p.target) < 0.05) snapAndLockPiece(p);
    }
  }

  updateProgress();
  renderer.render(scene, camera);
}

function updateFinalDisplay() {
  if (!lubanGroup) return;

  hideAllGhostTargets();
  lubanGroup.rotation.y += FINAL_ROTATION_SPEED;
  lubanGroup.scale.lerp(FINAL_DISPLAY_SCALE_VECTOR, FINAL_DISPLAY_LERP);

  const box = new THREE.Box3().setFromObject(lubanGroup);
  const currentCenter = new THREE.Vector3();
  box.getCenter(currentCenter);

  const delta = FINAL_DISPLAY_CENTER.clone().sub(currentCenter);
  lubanGroup.position.add(delta.multiplyScalar(FINAL_CENTER_LERP));
}

function updateProgress() {
  if (!pieces.length) return;
  const lockedCount = pieces.filter((p) => p.locked).length;
  let total = 0;
  pieces.forEach((p) => {
    const startD = p.start.distanceTo(p.target);
    const currentD = p.object.position.distanceTo(p.target);
    total += p.locked ? 1 : THREE.MathUtils.clamp(1 - currentD / Math.max(startD, 0.001), 0, 1);
  });
  const progress = total / pieces.length;
  progressSmooth = THREE.MathUtils.lerp(progressSmooth, progress, 0.08);
  $("progressBar").style.width = `${Math.round(progressSmooth * 100)}%`;
}
