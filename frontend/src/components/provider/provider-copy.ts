export type ProviderLocale = "zh-CN" | "en";

export const providerCopy = {
  "zh-CN": {
    title: "模型与提供商",
    subtitle: "管理模型服务、模型目录和默认模型。配置保存后会立即出现在任务输入框的模型选择器中。",
    global: "全局",
    project: "当前项目",
    globalHint: "适用于所有项目",
    projectHint: "只覆盖当前项目",
    addProvider: "添加 Provider",
    presets: "快速添加",
    custom: "自定义",
    testConnection: "测试连接",
    discoverModels: "发现模型",
    discoveredModels: "发现并同步了 {count} 个模型",
    noProviders: "还没有 Provider",
    noProvidersBody: "添加一个 OpenAI-compatible Provider，然后为它配置模型。",
    providerId: "Provider ID",
    providerName: "显示名称",
    baseUrl: "Base URL",
    endpoint: "完整 Endpoint（可选）",
    apiKey: "API Key 环境变量",
    apiKeyPlaceholder: "DEEPSEEK_API_KEY",
    package: "协议",
    save: "保存",
    cancel: "取消",
    close: "关闭",
    edit: "编辑",
    remove: "删除",
    models: "个模型",
    addModel: "添加模型",
    modelId: "模型 ID",
    modelName: "显示名称",
    upstreamModelId: "上游 modelID",
    context: "上下文",
    output: "最大输出",
    default: "默认",
    setDefault: "设为默认",
    noModels: "还没有模型",
    advanced: "高级配置 JSON",
    advancedHint: "常规配置请使用上面的图形界面；只有需要批量编辑时才使用 JSON。",
    saveJson: "保存 JSON",
    inherited: "当前运行时会合并全局配置和项目覆盖。",
    deleteProviderConfirm: "删除这个 Provider 及其模型？",
    deleteModelConfirm: "删除这个模型？",
    invalidProviderId: "Provider ID 不能为空，也不能包含 /。",
    providerIdConflict: "这个 Provider ID 已存在。",
    modelIdConflict: "这个模型 ID 已存在。",
    invalidModelId: "模型 ID 不能为空，也不能包含 /。",
    loading: "正在读取配置…",
    globalPath: "~/.config/lumencortex/lumencortex.json",
    projectPath: "项目根目录/lumencortex.json",
    openaiCompatible: "[OI] Compatible",
    envHint: "这里只填写环境变量名。LumenCortex 会保存 {env:VAR_NAME} 引用，不会把真实密钥写入配置文件。",
    emptyProjectScope: "当前项目没有覆盖配置，将继承全局 Provider。",
    effectiveDefault: "当前默认"
    ,anthropicMessages: "Anthropic Messages"
    ,protocolHintOpenai: "[OI] Compatible：发送 /chat/completions 请求，密钥放在 Authorization: Bearer 请求头。"
    ,statusLoadFailed: "无法读取密钥状态。"
    ,protocolHintAnthropic: "Anthropic Messages：发送 /v1/messages 请求，密钥放在 x-api-key 请求头，并附带 anthropic-version。"
    ,anthropicBasePlaceholder: "https://api.anthropic.com"
    ,anthropicEndpointPlaceholder: "https://api.anthropic.com/v1/messages"
    ,endpointDefaultAnthropic: "留空时使用 baseURL + /v1/messages。"
    ,invalidEnvName: "API Key 环境变量名只能包含字母、数字和下划线，且以字母或下划线开头；不能直接粘贴密钥。"
    ,apiKeySection: "API Key"
    ,credentialSource: "来源"
    ,sourceEnv: "环境变量"
    ,sourceStored: "直接输入"
    ,keySaved: "已保存在本机"
    ,keyEnvSet: "环境变量 {name} 已设置"
    ,keyEnvUnset: "环境变量 {name} 未设置"
    ,keyNone: "未配置 API Key"
    ,keyInputPlaceholder: "输入 API Key"
    ,keyMasked: "••••••••"
    ,replaceKey: "替换"
    ,removeKey: "移除"
    ,confirmRemoveKey: "移除保存在本机的 API Key？"
    ,confirmRemoveKeyAction: "确认移除"
    ,storedHint: "密钥存储在 LumenCortex 配置目录的本地文件中（仅当前用户可读，未加密）。配置文件只保留一个引用；密钥不会再次显示，也不会发送给界面。"
    ,envSourceHint: "在编辑 Provider 时填写环境变量名，配置文件里保存 {env:NAME} 引用。"
    ,keySaveFailed: "保存 API Key 失败。"
    ,keyRemoveFailed: "移除 API Key 失败。"
  },
  en: {
    title: "Models & Providers",
    subtitle: "Manage model services, model catalogs, and the default model. Saved models appear immediately in the task composer.",
    global: "Global",
    project: "Project",
    globalHint: "Used by every project",
    projectHint: "Overrides this project only",
    addProvider: "Add provider",
    presets: "Quick add",
    custom: "Custom",
    testConnection: "Test connection",
    discoverModels: "Discover models",
    discoveredModels: "Discovered and synced {count} models",
    noProviders: "No providers yet",
    noProvidersBody: "Add an OpenAI-compatible provider, then define one or more models.",
    providerId: "Provider ID",
    providerName: "Display name",
    baseUrl: "Base URL",
    endpoint: "Exact endpoint (optional)",
    apiKey: "API key environment variable",
    apiKeyPlaceholder: "DEEPSEEK_API_KEY",
    package: "Protocol",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    remove: "Delete",
    models: "models",
    addModel: "Add model",
    modelId: "Model ID",
    modelName: "Display name",
    upstreamModelId: "Upstream modelID",
    context: "Context",
    output: "Max output",
    default: "Default",
    setDefault: "Set default",
    noModels: "No models yet",
    advanced: "Advanced JSON",
    advancedHint: "Use the graphical controls above for normal editing. JSON is intended for bulk or advanced edits.",
    saveJson: "Save JSON",
    inherited: "Runtime uses the merged result of global settings and project overrides.",
    deleteProviderConfirm: "Delete this provider and all of its models?",
    deleteModelConfirm: "Delete this model?",
    invalidProviderId: "Provider ID is required and cannot contain /.",
    providerIdConflict: "This Provider ID already exists.",
    modelIdConflict: "This model ID already exists.",
    invalidModelId: "Model ID is required and cannot contain /.",
    loading: "Loading provider settings…",
    globalPath: "~/.config/lumencortex/lumencortex.json",
    projectPath: "project/lumencortex.json",
    openaiCompatible: "[OI] Compatible",
    envHint: "Enter only the environment variable name. LumenCortex stores a {env:VAR_NAME} reference and never persists the resolved secret.",
    emptyProjectScope: "This project has no overrides and inherits global providers.",
    effectiveDefault: "Effective default"
    ,anthropicMessages: "Anthropic Messages"
    ,protocolHintOpenai: "[OI] Compatible: sends /chat/completions requests with the key in an Authorization: Bearer header."
    ,statusLoadFailed: "Could not read the key status."
    ,protocolHintAnthropic: "Anthropic Messages: sends /v1/messages requests with the key in an x-api-key header, plus anthropic-version."
    ,anthropicBasePlaceholder: "https://api.anthropic.com"
    ,anthropicEndpointPlaceholder: "https://api.anthropic.com/v1/messages"
    ,endpointDefaultAnthropic: "Defaults to baseURL + /v1/messages when empty."
    ,invalidEnvName: "The API key environment variable name may only contain letters, digits and underscores and must start with a letter or underscore; pasting a literal key is not supported."
    ,apiKeySection: "API key"
    ,credentialSource: "Source"
    ,sourceEnv: "Environment variable"
    ,sourceStored: "Direct input"
    ,keySaved: "Saved locally"
    ,keyEnvSet: "Environment variable {name} is set"
    ,keyEnvUnset: "Environment variable {name} is not set"
    ,keyNone: "No API key configured"
    ,keyInputPlaceholder: "Enter the API key"
    ,keyMasked: "••••••••"
    ,replaceKey: "Replace"
    ,removeKey: "Remove"
    ,confirmRemoveKey: "Remove the API key stored on this machine?"
    ,confirmRemoveKeyAction: "Confirm removal"
    ,storedHint: "The key is stored in a local file in the LumenCortex config folder (readable only by your user, not encrypted). The config file keeps only a reference. It is never shown again or sent to the interface."
    ,envSourceHint: "Set the variable name when editing the provider; the file stores an {env:NAME} reference."
    ,keySaveFailed: "Saving the API key failed."
    ,keyRemoveFailed: "Removing the API key failed."
  }
} as const;
