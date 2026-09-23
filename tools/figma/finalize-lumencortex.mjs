export async function buildFigmaDelivery(figma, TARGET = "product-screens") {
// LumenCortex Figma finalizer.
// Paste this file into Figma MCP use_figma after setting TARGET to one of:
// "design-system", "product-screens", "flows-and-specs".
// The script is idempotent for generated LCX assets and switches page at most once.


const C = {
  bg: "#F6F6F4",
  sidebar: "#F3F3F0",
  surface: "#FFFFFF",
  subtle: "#F8F8F6",
  hover: "#ECECEA",
  border: "#E7E7E2",
  borderStrong: "#D6D6D0",
  text: "#252525",
  textSoft: "#60605C",
  muted: "#8C8C86",
  accent: "#181918",
  white: "#FFFFFF",
  success: "#2F7D4F",
  warning: "#9A691B",
  danger: "#B0444E",
  info: "#4F72A8",
  successBg: "#EEF6F1",
  warningBg: "#FBF4E8",
  dangerBg: "#FAEFF0",
  infoBg: "#EEF2F8",
};

function rgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function solid(hex, opacity = 1) {
  return [{ type: "SOLID", color: rgb(hex), opacity }];
}

function stroke(node, hex = C.border, weight = 1) {
  node.strokes = solid(hex);
  node.strokeWeight = weight;
}

function configureAuto(node, direction = "VERTICAL", gap = 0, padding = 0) {
  node.layoutMode = direction;
  node.itemSpacing = gap;
  node.paddingTop = padding;
  node.paddingRight = padding;
  node.paddingBottom = padding;
  node.paddingLeft = padding;
  node.primaryAxisSizingMode = "FIXED";
  node.counterAxisSizingMode = "FIXED";
}

async function makeText(value, size = 12, color = C.text, weight = "Regular", width = null) {
  const fontName = { family: "Inter", style: weight };
  await figma.loadFontAsync(fontName);
  const node = figma.createText();
  node.fontName = fontName;
  node.fontSize = size;
  node.fills = solid(color);
  node.characters = value;
  if (width) {
    node.resize(width, Math.max(18, size * 1.5));
    node.textAutoResize = "HEIGHT";
  } else {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  return node;
}

function makeFrame(name, width, height, fill = C.surface, radius = 0) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(width, height);
  frame.fills = solid(fill);
  frame.cornerRadius = radius;
  frame.clipsContent = true;
  return frame;
}

function addTo(parent, child, grow = false) {
  parent.appendChild(child);
  if (grow) child.layoutGrow = 1;
  return child;
}

async function getOrCreatePage(name) {
  let page = figma.root.children.find((item) => item.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  await figma.setCurrentPageAsync(page);
  return page;
}

function removeGenerated(page, predicates) {
  const removed = [];
  for (const node of [...page.children]) {
    if (predicates.some((fn) => fn(node))) {
      removed.push(node.id);
      node.remove();
    }
  }
  return removed;
}

async function makeTopbar(width, title, subtitle, compact = false) {
  const bar = makeFrame("Topbar", width, 52, C.surface);
  configureAuto(bar, "HORIZONTAL", 10, 12);
  bar.primaryAxisAlignItems = "CENTER";
  bar.counterAxisAlignItems = "CENTER";
  stroke(bar, C.border);
  const menu = await makeText(compact ? "Menu" : "LumenCortex", 11, C.textSoft, "Medium");
  addTo(bar, menu);
  const stack = makeFrame("Title", compact ? Math.max(180, width - 160) : Math.max(300, width - 360), 28, C.surface);
  configureAuto(stack, "VERTICAL", 1, 0);
  const t = await makeText(title, 12, C.text, "Semi Bold");
  const s = await makeText(subtitle, 9, C.muted, "Regular");
  addTo(stack, t);
  addTo(stack, s);
  addTo(bar, stack, true);
  const activity = await makeText("Activity", 10, C.textSoft, "Medium");
  addTo(bar, activity);
  return bar;
}

async function makeSidebar(height) {
  const sidebar = makeFrame("Sidebar", 220, height, C.sidebar);
  configureAuto(sidebar, "VERTICAL", 8, 12);
  stroke(sidebar, C.border);
  addTo(sidebar, await makeText("LumenCortex", 13, C.text, "Semi Bold"));
  addTo(sidebar, await makeText("＋ 新任务", 11, C.text, "Medium"));
  addTo(sidebar, await makeText("项目  lumencortex", 10, C.textSoft, "Medium"));
  for (const [group, items] of [
    ["进行中", ["Provider settings refactor"]],
    ["需要处理", ["Approve database migration"]],
    ["最近", ["Improve review diff rendering"]],
  ]) {
    addTo(sidebar, await makeText(group, 9, C.muted, "Semi Bold"));
    for (const item of items) {
      const row = makeFrame("Thread row", 196, 34, C.surface, 7);
      configureAuto(row, "HORIZONTAL", 7, 7);
      addTo(row, await makeText(item, 9, C.textSoft, "Medium", 160));
      addTo(sidebar, row);
    }
  }
  const spacer = makeFrame("Spacer", 1, 1, C.sidebar);
  addTo(sidebar, spacer, true);
  addTo(sidebar, await makeText("模型与提供商", 10, C.textSoft, "Medium"));
  addTo(sidebar, await makeText("扩展", 10, C.textSoft, "Medium"));
  addTo(sidebar, await makeText("运行时在线 · 中文", 9, C.muted, "Regular"));
  return sidebar;
}

async function composer(width, compact = false) {
  const box = makeFrame("Composer", width, compact ? 156 : 174, C.surface, 16);
  configureAuto(box, "VERTICAL", 8, 12);
  stroke(box, C.borderStrong);
  addTo(box, await makeText("描述一个编码任务，例如：修复登录超时并补充测试", compact ? 11 : 12, C.muted, "Regular", width - 24));
  const spacer = makeFrame("Composer spacer", 1, 1, C.surface);
  addTo(box, spacer, true);
  const chips = makeFrame("Composer controls", width - 24, 30, C.surface);
  configureAuto(chips, "HORIZONTAL", 6, 0);
  for (const label of ["lumencortex", "GPT-5.6", "工作区", "Worktree"]) {
    const chip = makeFrame("Control", Math.max(62, label.length * 8 + 18), 28, C.subtle, 7);
    configureAuto(chip, "HORIZONTAL", 4, 7);
    addTo(chip, await makeText(label, 9, C.textSoft, "Medium"));
    addTo(chips, chip);
  }
  const action = makeFrame("Send", 30, 28, C.accent, 8);
  configureAuto(action, "HORIZONTAL", 0, 7);
  addTo(action, await makeText("↑", 12, C.white, "Semi Bold"));
  addTo(chips, action);
  addTo(box, chips);
  return box;
}

async function makeNewTask(width, height) {
  const compact = width <= 820;
  const screen = makeFrame(`Screen / New Task / ${width}`, width, height, C.bg, 0);
  configureAuto(screen, "VERTICAL", 0, 0);
  addTo(screen, await makeTopbar(width, "lumencortex", "本地", compact));
  const body = makeFrame("Body", width, height - 52, C.bg);
  configureAuto(body, "HORIZONTAL", 0, 0);
  if (!compact) addTo(body, await makeSidebar(height - 52));
  const mainWidth = compact ? width : width - 220;
  const main = makeFrame("Main", mainWidth, height - 52, C.surface);
  configureAuto(main, "VERTICAL", 14, compact ? 18 : 28);
  main.primaryAxisAlignItems = "CENTER";
  main.counterAxisAlignItems = "CENTER";
  const spacerTop = makeFrame("Top spacer", 1, compact ? 150 : 190, C.surface);
  addTo(main, spacerTop);
  addTo(main, await makeText("想让 LumenCortex 做什么？", compact ? 22 : 29, C.text, "Medium"));
  addTo(main, await makeText("描述任务，选择项目、模型和权限，然后直接开始。", compact ? 10 : 11, C.muted, "Regular", Math.min(620, mainWidth - 40)));
  addTo(main, await composer(Math.min(compact ? mainWidth - 20 : 760, mainWidth - 40), compact));
  addTo(body, main, true);
  addTo(screen, body, true);
  return screen;
}

async function makeRunningThread(width, height) {
  const compact = width <= 820;
  const screen = makeFrame(`Screen / Running Thread / ${width}`, width, height, C.bg);
  configureAuto(screen, "VERTICAL", 0, 0);
  addTo(screen, await makeTopbar(width, "Refactor provider settings and add tests", compact ? "Worktree · GPT-5.6 · 运行中" : "Worktree · GPT-5.6 · Active", compact));
  const body = makeFrame("Body", width, height - 52, C.bg);
  configureAuto(body, "HORIZONTAL", 0, 0);
  if (!compact) addTo(body, await makeSidebar(height - 52));
  const mainWidth = compact ? width : width - 220;
  const main = makeFrame("Thread", mainWidth, height - 52, C.surface);
  configureAuto(main, "VERTICAL", 10, compact ? 14 : 24);
  addTo(main, await makeText("任务", 9, C.muted, "Semi Bold"));
  const intro = makeFrame("Task intro", mainWidth - (compact ? 28 : 48), 54, C.subtle, 9);
  configureAuto(intro, "VERTICAL", 4, 10);
  addTo(intro, await makeText("Refactor provider settings and add tests without changing public behavior", 11, C.text, "Medium", intro.width - 20));
  addTo(intro, await makeText("OpenAI · GPT-5.6 · Worktree", 9, C.muted, "Regular"));
  addTo(main, intro);
  for (const [role, bodyText] of [
    ["你", "Refactor provider settings and add tests."],
    ["LumenCortex", "我会先检查 Provider 配置和现有测试，再保持当前配置契约。"],
    ["工具", "search_text · internal/backend/provider_config.go · success"],
  ]) {
    const msg = makeFrame(role, mainWidth - (compact ? 28 : 48), role === "工具" ? 52 : 68, role === "工具" ? C.subtle : C.surface, 8);
    configureAuto(msg, "VERTICAL", 4, 10);
    if (role !== "工具") stroke(msg, C.border);
    addTo(msg, await makeText(role, 9, C.muted, "Semi Bold"));
    addTo(msg, await makeText(bodyText, 10, C.textSoft, "Regular", msg.width - 20));
    addTo(main, msg);
  }
  const fill = makeFrame("Thread spacer", 1, 1, C.surface);
  addTo(main, fill, true);
  addTo(main, await composer(Math.min(760, mainWidth - (compact ? 20 : 48)), compact));
  addTo(body, main, true);
  addTo(screen, body, true);
  return screen;
}

async function makeProvider(width, height) {
  const compact = width <= 820;
  const screen = makeFrame(`Screen / Provider Settings / ${width}`, width, height, C.bg);
  configureAuto(screen, "VERTICAL", 0, 0);
  addTo(screen, await makeTopbar(width, "模型与提供商", compact ? "全局与项目配置" : "Global & project configuration", compact));
  const body = makeFrame("Body", width, height - 52, C.bg);
  configureAuto(body, "HORIZONTAL", 0, 0);
  if (!compact) addTo(body, await makeSidebar(height - 52));
  const mainWidth = compact ? width : width - 220;
  const main = makeFrame("Providers", mainWidth, height - 52, C.surface);
  configureAuto(main, "VERTICAL", 12, compact ? 14 : 24);
  const heading = makeFrame("Heading", mainWidth - (compact ? 28 : 48), 58, C.surface);
  configureAuto(heading, "VERTICAL", 4, 0);
  addTo(heading, await makeText("模型与提供商", compact ? 20 : 24, C.text, "Medium"));
  addTo(heading, await makeText("管理模型服务、模型目录和默认模型。", 10, C.muted, "Regular"));
  addTo(main, heading);
  const scope = makeFrame("Scope", compact ? 200 : 240, 32, C.subtle, 8);
  configureAuto(scope, "HORIZONTAL", 4, 4);
  for (const label of ["全局", "当前项目"]) {
    const tab = makeFrame(label, label === "全局" ? 84 : 104, 24, label === "当前项目" ? C.surface : C.subtle, 6);
    configureAuto(tab, "HORIZONTAL", 0, 6);
    addTo(tab, await makeText(label, 9, C.textSoft, "Medium"));
    addTo(scope, tab);
  }
  addTo(main, scope);
  for (const item of [
    ["OpenAI", "openai", "https://api.openai.com/v1", "2 个模型 · 默认 GPT-5.6"],
    ["DeepSeek", "deepseek", "https://api.deepseek.com/v1", "1 个模型 · 缺少密钥"],
  ]) {
    const card = makeFrame("Provider card", mainWidth - (compact ? 28 : 48), compact ? 116 : 132, C.surface, 10);
    configureAuto(card, "VERTICAL", 5, 12);
    stroke(card, C.border);
    addTo(card, await makeText(item[0], 12, C.text, "Semi Bold"));
    addTo(card, await makeText(`${item[1]} · OpenAI Compatible`, 9, C.muted, "Regular"));
    addTo(card, await makeText(item[2], 9, C.textSoft, "Regular", card.width - 24));
    addTo(card, await makeText(item[3], 9, item[3].includes("缺少") ? C.warning : C.success, "Medium"));
    addTo(main, card);
  }
  addTo(main, await makeText("高级配置 JSON", 10, C.textSoft, "Medium"));
  addTo(body, main, true);
  addTo(screen, body, true);
  return screen;
}

async function makeReview(width, height) {
  const compact = width <= 820;
  const screen = makeFrame(`Screen / Review Diff / ${width}`, width, height, C.bg);
  configureAuto(screen, "VERTICAL", 0, 0);
  addTo(screen, await makeTopbar(width, "审查", compact ? "3 个变更文件 · 本地" : "3 changed files · Local", compact));
  const body = makeFrame("Body", width, height - 52, C.bg);
  configureAuto(body, compact ? "VERTICAL" : "HORIZONTAL", 0, 0);
  if (!compact) addTo(body, await makeSidebar(height - 52));
  const mainWidth = compact ? width : width - 220;
  const review = makeFrame("Review", mainWidth, height - 52, C.surface);
  configureAuto(review, compact ? "VERTICAL" : "HORIZONTAL", 0, 0);
  const rail = makeFrame("Changed files", compact ? mainWidth : 250, compact ? 128 : height - 52, C.subtle);
  configureAuto(rail, "VERTICAL", 5, 10);
  addTo(rail, await makeText("已更改文件 · 3", 9, C.muted, "Semi Bold"));
  for (const file of ["ProviderSettingsPanel.tsx", "provider-settings.css", "ProviderSettingsPanel.test.tsx"]) {
    const row = makeFrame("File", compact ? mainWidth - 20 : 230, 28, C.surface, 6);
    configureAuto(row, "HORIZONTAL", 6, 6);
    addTo(row, await makeText(file, 9, C.textSoft, "Medium", row.width - 12));
    addTo(rail, row);
  }
  addTo(review, rail);
  const diffHeight = compact ? height - 52 - 128 : height - 52;
  const diff = makeFrame("Diff", compact ? mainWidth : mainWidth - 250, diffHeight, C.surface);
  configureAuto(diff, "VERTICAL", 7, 12);
  const header = makeFrame("Diff header", diff.width - 24, 34, C.surface);
  configureAuto(header, "HORIZONTAL", 8, 4);
  addTo(header, await makeText("frontend/src/components/provider/ProviderSettingsPanel.tsx", 9, C.textSoft, "Medium", Math.max(220, header.width - 150)));
  addTo(header, await makeText(compact ? "统一" : "统一 · 分栏", 9, C.info, "Medium"));
  addTo(diff, header);
  for (const [prefix, line, color, bg] of [
    ["18", "const t = providerCopy[locale];", C.textSoft, C.surface],
    ["19", "- const controller = useProviderSettingsController(options);", C.danger, C.dangerBg],
    ["20", "+ const controller = useProviderSettingsController({", C.success, C.successBg],
    ["21", "+   locale, workspace, selectedModelRef,", C.success, C.successBg],
    ["22", "+ });", C.success, C.successBg],
  ]) {
    const code = makeFrame("Diff line", diff.width - 24, 26, bg);
    configureAuto(code, "HORIZONTAL", 8, 5);
    addTo(code, await makeText(prefix, 8, C.muted, "Regular"));
    addTo(code, await makeText(line, 9, color, "Regular", Math.max(200, code.width - 38)));
    addTo(diff, code);
  }
  const feedback = makeFrame("Inline feedback", diff.width - 24, 72, C.subtle, 8);
  configureAuto(feedback, "VERTICAL", 4, 8);
  addTo(feedback, await makeText("告诉 Agent 这个文件需要怎么改…", 9, C.muted, "Regular", feedback.width - 16));
  addTo(feedback, await makeText("发送给 Agent", 9, C.info, "Medium"));
  addTo(diff, feedback);
  addTo(review, diff, true);
  addTo(body, review, true);
  addTo(screen, body, true);
  return screen;
}

async function buildProductScreens() {
  const page = await getOrCreatePage("02 Product Screens");
  const removed = removeGenerated(page, [
    (n) => n.name.startsWith("Screen / "),
    (n) => n.name === "LCX / Product Screens Header",
  ]);
  const created = [];
  const header = makeFrame("LCX / Product Screens Header", 1440, 92, C.bg);
  configureAuto(header, "VERTICAL", 6, 18);
  addTo(header, await makeText("LumenCortex · Product Screens", 24, C.text, "Medium"));
  addTo(header, await makeText("Production-aligned responsive references · Light canonical · Chinese-first copy", 10, C.muted, "Regular"));
  page.appendChild(header);
  header.x = 0;
  header.y = 0;
  created.push(header.id);

  const widths = [1440, 1180, 820, 560];
  const builders = [
    ["New Task", makeNewTask],
    ["Running Thread", makeRunningThread],
    ["Provider Settings", makeProvider],
    ["Review Diff", makeReview],
  ];
  let y = 140;
  for (const [, builder] of builders) {
    let x = 0;
    for (const width of widths) {
      const screen = await builder(width, 900);
      page.appendChild(screen);
      screen.x = x;
      screen.y = y;
      x += width + 64;
      created.push(screen.id);
    }
    y += 980;
  }
  return { pageId: page.id, createdNodeIds: created, removedNodeIds: removed };
}

async function makeVariantComponent(name, label, state, tone = "neutral", width = 150, height = 40) {
  const comp = figma.createComponent();
  comp.name = `State=${state}`;
  comp.resize(width, height);
  configureAuto(comp, "HORIZONTAL", 6, 10);
  comp.primaryAxisAlignItems = "CENTER";
  comp.counterAxisAlignItems = "CENTER";
  comp.cornerRadius = 8;

  const disabled = state === "Disabled";
  const focus = state === "Focus";
  const hover = state === "Hover";
  const pressed = state === "Pressed";
  const invalid = state === "Invalid" || state === "Error";
  const selected = state === "Selected";
  const running = state === "Running";
  const loading = state === "Loading";

  let fillColor = C.surface;
  let textColor = C.textSoft;
  let borderColor = C.border;
  if (name.includes("Primary")) {
    fillColor = disabled ? C.borderStrong : pressed ? C.textSoft : hover ? "#343534" : C.accent;
    textColor = C.white;
    borderColor = fillColor;
  } else if (name.includes("Destructive")) {
    fillColor = disabled ? C.dangerBg : C.danger;
    textColor = disabled ? C.muted : C.white;
    borderColor = fillColor;
  } else if (selected || running) {
    fillColor = C.infoBg;
    textColor = C.info;
    borderColor = C.info;
  } else if (invalid) {
    fillColor = C.dangerBg;
    textColor = C.danger;
    borderColor = C.danger;
  } else if (hover) {
    fillColor = C.hover;
  } else if (focus) {
    borderColor = C.accent;
  }
  if (tone === "success") { fillColor = C.successBg; textColor = C.success; borderColor = C.success; }
  if (tone === "warning") { fillColor = C.warningBg; textColor = C.warning; borderColor = C.warning; }
  if (tone === "danger") { fillColor = C.dangerBg; textColor = C.danger; borderColor = C.danger; }
  if (tone === "info") { fillColor = C.infoBg; textColor = C.info; borderColor = C.info; }
  comp.fills = solid(fillColor, disabled ? 0.72 : 1);
  stroke(comp, borderColor, focus ? 2 : 1);
  if (pressed) comp.y = 1;
  const content = loading ? "Loading…" : label;
  addTo(comp, await makeText(content, 10, textColor, "Medium"));
  return comp;
}

async function buildVariantSet(page, name, states, x, y, options = {}) {
  const comps = [];
  for (const state of states) {
    const tone = options.tones?.[state] || "neutral";
    comps.push(await makeVariantComponent(name, options.label || name.split(" / ").pop(), state, tone, options.width || 150, options.height || 40));
  }
  const set = figma.combineAsVariants(comps, page);
  set.name = name;
  set.description = options.description || `Production state coverage for ${name}.`;
  set.x = x;
  set.y = y;
  const gap = 18;
  let cursor = 20;
  let maxH = 0;
  for (const child of set.children) {
    child.x = cursor;
    child.y = 42;
    cursor += child.width + gap;
    maxH = Math.max(maxH, child.height);
  }
  set.resizeWithoutConstraints(Math.max(220, cursor + 2), maxH + 64);
  return { set, components: comps };
}

async function buildDesignSystemStates() {
  const page = await getOrCreatePage("01 Design System");
  const removed = removeGenerated(page, [
    (n) => n.name.startsWith("LCX / "),
    (n) => n.type === "COMPONENT_SET" && n.name.endsWith(" · Production States"),
  ]);
  const created = [];
  const header = makeFrame("LCX / Production State Matrix", 1400, 96, C.bg);
  configureAuto(header, "VERTICAL", 6, 18);
  addTo(header, await makeText("Production State Matrix", 24, C.text, "Medium"));
  addTo(header, await makeText("Light canonical · component states mirror frontend interaction contracts", 10, C.muted, "Regular"));
  page.appendChild(header);
  header.x = 0;
  header.y = 900;
  created.push(header.id);

  const rows = [
    ["Button / Primary · Production States", ["Default","Hover","Focus","Pressed","Disabled","Loading"], { label: "Primary" }],
    ["Button / Secondary · Production States", ["Default","Hover","Focus","Pressed","Disabled","Loading"], { label: "Secondary" }],
    ["Button / Destructive · Production States", ["Default","Hover","Focus","Pressed","Disabled","Loading"], { label: "Delete" }],
    ["Input · Production States", ["Default","Focus","Invalid","Disabled"], { label: "Input value", width: 210 }],
    ["Select · Production States", ["Default","Hover","Focus","Selected","Disabled"], { label: "GPT-5.6", width: 180 }],
    ["Thread Row · Production States", ["Default","Hover","Selected","Running","Attention","Error"], { label: "Provider settings refactor", width: 230 }],
    ["Composer · Production States", ["Default","Focus","Running","Disabled","Error"], { label: "Describe a coding task…", width: 260, height: 58 }],
    ["Status Indicator · Production States", ["Running","Success","Waiting","Interrupted","Info","Completed"], {
      label: "Status",
      width: 145,
      tones: { Running: "success", Success: "success", Waiting: "warning", Interrupted: "danger", Info: "info", Completed: "neutral" },
    }],
  ];

  let y = 1030;
  for (const [name, states, options] of rows) {
    const { set, components } = await buildVariantSet(page, name, states, 0, y, options);
    created.push(set.id, ...components.map((c) => c.id));
    y += set.height + 42;
  }
  return { pageId: page.id, createdNodeIds: created, removedNodeIds: removed };
}

async function flowStateFrame(name, width, height, title, lines, accent = C.info) {
  const frame = makeFrame(name, width, height, C.surface, 10);
  configureAuto(frame, "VERTICAL", 6, 12);
  stroke(frame, C.border);
  addTo(frame, await makeText(title, 11, C.text, "Semi Bold"));
  for (const line of lines) addTo(frame, await makeText(line, 9, C.textSoft, "Regular", width - 24));
  const marker = makeFrame("Motion marker", 92, 22, C.subtle, 6);
  configureAuto(marker, "HORIZONTAL", 0, 5);
  stroke(marker, accent);
  addTo(marker, await makeText("Prototype state", 8, accent, "Medium"));
  addTo(frame, marker);
  return frame;
}

async function makeFlowCard(title, width, beforeLines, afterLines, timing, reduced) {
  const card = makeFrame(`Flow / ${title}`, width, 270, C.bg, 12);
  configureAuto(card, "VERTICAL", 10, 14);
  stroke(card, C.border);
  addTo(card, await makeText(title, 15, C.text, "Semi Bold"));
  addTo(card, await makeText(`${timing} · Reduced motion: ${reduced}`, 9, C.muted, "Regular", width - 28));
  const states = makeFrame("States", width - 28, 178, C.bg);
  configureAuto(states, "HORIZONTAL", 12, 0);
  const before = await flowStateFrame("Before", (width - 64) / 2, 178, "Before", beforeLines);
  const after = await flowStateFrame("After", (width - 64) / 2, 178, "After", afterLines, C.success);
  addTo(states, before);
  addTo(states, after);
  addTo(card, states);
  return card;
}

async function buildFlowsAndSpecs() {
  const page = await getOrCreatePage("03 Flows & Specs");
  const removed = removeGenerated(page, [
    (n) => n.name.startsWith("Flow / "),
    (n) => n.name.startsWith("LCX / "),
  ]);
  const created = [];
  const header = makeFrame("LCX / Flows & Specs Header", 1280, 130, C.bg);
  configureAuto(header, "VERTICAL", 6, 18);
  addTo(header, await makeText("LumenCortex · Flows & Motion Specs", 24, C.text, "Medium"));
  addTo(header, await makeText("Motion explains state change; no springs, bounce, fake progress, or layout-heavy animation.", 10, C.muted, "Regular", 1200));
  addTo(header, await makeText("Tokens: 80ms instant · 120ms fast · 160ms base · 200ms panel · 220ms page · max normal 260ms", 10, C.textSoft, "Medium"));
  page.appendChild(header);
  header.x = 0;
  header.y = 0;
  created.push(header.id);

  const cards = [
    await makeFlowCard(
      "Sidebar / Inspector drawer",
      1280,
      ["Panel closed", "Trigger remains visible", "Focus stays in workspace"],
      ["Panel enters from its owning edge", "Focus moves into drawer", "Backdrop appears on compact layouts"],
      "200 ms · ease-out · translateX + opacity",
      "Immediate or opacity-only"
    ),
    await makeFlowCard(
      "Composer → Thread",
      1280,
      ["Centered task composer", "Task text remains stable", "Send action ready"],
      ["Thread shell appears", "Composer moves to footer without dramatic path", "Run status visible immediately"],
      "160 ms · ease-standard · opacity + translateY 4px",
      "Immediate state swap"
    ),
    await makeFlowCard(
      "Provider expand / collapse",
      1280,
      ["Provider row collapsed", "Summary and model count visible"],
      ["Body reveals in place", "Chevron rotates 90°", "First meaningful field can receive focus"],
      "140–160 ms · ease-standard · opacity + translateY 2px",
      "Immediate reveal"
    ),
    await makeFlowCard(
      "Review inline comment",
      1280,
      ["Diff remains spatially stable", "Selected line highlighted"],
      ["Inline comment editor appears", "Feedback returns to task loop", "No diff-line entrance animation"],
      "160 ms · ease-out · opacity + translateY 4px",
      "Opacity-only"
    ),
  ];
  let y = 170;
  for (const card of cards) {
    page.appendChild(card);
    card.x = 0;
    card.y = y;
    y += card.height + 34;
    created.push(card.id);
  }

  const reduced = makeFrame("LCX / Reduced Motion Contract", 1280, 178, C.surface, 10);
  configureAuto(reduced, "VERTICAL", 8, 14);
  stroke(reduced, C.border);
  addTo(reduced, await makeText("Reduced Motion Contract", 14, C.text, "Semi Bold"));
  for (const line of [
    "Honor prefers-reduced-motion: reduce.",
    "Use immediate state changes or opacity-only transitions where motion carries spatial meaning.",
    "Never depend on animation alone to communicate running, waiting, success, or error.",
    "Do not animate streaming text, diff hunks, list reordering, width/height, or expensive filters.",
  ]) addTo(reduced, await makeText("• " + line, 9, C.textSoft, "Regular", 1240));
  page.appendChild(reduced);
  reduced.x = 0;
  reduced.y = y;
  created.push(reduced.id);

  return { pageId: page.id, createdNodeIds: created, removedNodeIds: removed };
}

if (!["design-system", "product-screens", "flows-and-specs"].includes(TARGET)) {
  throw new Error("Set TARGET to design-system, product-screens, or flows-and-specs");
}

let result;
if (TARGET === "design-system") result = await buildDesignSystemStates();
if (TARGET === "product-screens") result = await buildProductScreens();
if (TARGET === "flows-and-specs") result = await buildFlowsAndSpecs();

return { target: TARGET, ...result };

}
