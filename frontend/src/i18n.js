/**
 * @description 轻量三语言国际化模块。
 * 支持繁体中文（zh-TW）、简体中文（zh-CN）、英文（en）。
 * 默认语言为繁体中文。
 */
import { ref, computed } from 'vue';

/** @type {string[]} 支持的语言列表 */
export const SUPPORTED_LANGS = ['zh-TW', 'zh-CN', 'en'];

/** @type {Record<string, string>} 语言显示名称 */
export const LANG_LABELS = {
    'zh-TW': '繁中',
    'zh-CN': '简中',
    'en': 'EN',
};

/** @type {Ref<string>} 当前语言 */
export const currentLang = ref(
    localStorage.getItem('keynest_lang') || 'en'
);

/**
 * @description 切换语言并持久化到 localStorage。
 * @param {string} lang - 目标语言代码。
 */
export function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang.value = lang;
    localStorage.setItem('keynest_lang', lang);
}

/** @type {Record<string, Record<string, string>>} 翻译资源 */
const messages = {
    'zh-TW': {
        // ── App / Header ──
        appTitle: 'KeyNest',
        tabChecker: '檢測台',
        tabKey: 'Key',
        statusChecking: '檢測中',
        statusPaused: '已暫停',
        statusIdle: '待命',

        // ── Provider Selector ──
        labelProvider: '提供商',
        labelStream: '串流',
        titleStream: '啟用串流檢測 (Stream Mode)',
        titleSettings: '檢測設定',
        ariaSearchProvider: '搜尋提供商',
        ariaProviderList: 'API 提供商列表',

        // ── Api Config ──
        labelBaseUrl: '基礎 URL',
        labelModel: '模型',
        placeholderBaseUrl: 'API Base URL',
        placeholderModel: '測試用的模型名稱',
        btnFetch: '獲取',

        // ── Key Input ──
        labelApiKeys: 'API 金鑰',
        btnImportFile: '匯入檔案',
        btnImporting: '匯入中',
        btnClearInput: '清空輸入',
        placeholderKeys: '貼上 API Key，或拖入 .txt 檔案。多個 Key 可用逗號、分號或換行分隔。',

        // ── Action Buttons ──
        btnStartCheck: '開始檢測',
        btnStop: '停止',
        btnPause: '暫停',
        btnResume: '繼續',

        // ── Result Tabs ──
        tabValid: '有效',
        tabLowBalance: '低額',
        tabZeroBalance: '零額',
        tabRateLimit: '限流',
        tabInvalid: '無效',
        tabDuplicate: '重複',

        // ── Result Panel ──
        btnCopy: '複製',
        btnDetails: '詳情',
        btnModels: '模型',
        btnCopied: '已複製',
        btnCopyFailed: '失敗',
        sortDefault: '預設排序',
        sortBalanceDesc: '餘額高',
        sortBalanceAsc: '餘額低',
        ariaSort: '排序方式',
        ariaSortOptions: '排序選項',
        placeholderSearch: '在結果中搜尋...',
        emptyState: '檢測結果將顯示在這裡',

        // ── Key Manager ──
        btnAddKey: '新增 Key',
        btnImportExport: '匯入/匯出',
        btnCloudBackup: '雲端備份',
        cloudBackupTitle: '雲端備份',
        cloudBackupHint: 'Backup Token 相當於你的備份身份。請用「生成」建立長隨機碼，並在其他裝置填入同一 Token 即可恢復。Token 只保存在本機瀏覽器，請自行妥善保存。',
        labelBackupToken: 'Backup Token',
        placeholderBackupToken: '至少 16 位，建議使用生成的隨機碼',
        btnGenerateToken: '生成',
        btnCopyToken: '複製 Token',
        btnShowToken: '顯示',
        btnHideToken: '隱藏',
        btnCheckBackup: '查詢雲端',
        btnBackupUpload: '備份到雲端',
        btnBackupRestoreMerge: '恢復（合併）',
        btnBackupRestoreReplace: '恢復（覆蓋）',
        btnBackupDelete: '刪除雲端備份',
        btnBackupWorking: '處理中…',
        cloudBackupMetaLine: '雲端：{count} 個 Key · 更新於 {time}',
        confirmBackupReplace: '覆蓋恢復會清空本機所有 Key 後再寫入雲端備份，確定繼續？',
        confirmBackupDelete: '確定刪除此 Token 對應的雲端備份？此操作不可復原。',
        toastBackupTokenGenerated: '已生成 Backup Token，請複製到其他裝置',
        toastBackupTokenCopied: 'Token 已複製',
        toastBackupTokenRequired: '請先填寫 Backup Token',
        toastBackupTokenTooShort: 'Token 至少需要 {min} 個字元',
        toastBackupEmpty: '本地沒有可備份的 Key',
        toastBackupUploaded: '已備份 {count} 個 Key 到雲端',
        toastBackupRestoredMerge: '已合併恢復 {count} 個新 Key',
        toastBackupRestoredReplace: '已覆蓋恢復 {count} 個 Key',
        toastBackupNoNewKeys: '雲端備份中沒有可合併的新 Key（可能均已存在）',
        toastBackupDeleted: '雲端備份已刪除',
        toastBackupMeta: '雲端有 {count} 個 Key，更新於 {time}',
        toastBackupInvalid: '雲端備份格式無效',
        toastBackupFailed: '雲端備份失敗: {msg}',
        kmCount: '{filtered} / {total} 個 Key',
        placeholderSearchKm: '搜尋 Key、別名、標籤...',
        filterAllProviders: '全部平台',
        filterAllStatus: '全部狀態',
        sortCreatedAt: '建立時間',
        sortLastChecked: '最近檢測',
        sortBalance: '餘額',
        sortProvider: '平台',
        sortPrefix: '排序: ',
        titleAsc: '升序',
        titleDesc: '降序',
        batchSelectAll: '全選',
        batchSelected: '已選 {count} 個',
        btnBatchDelete: '批量刪除',
        ieTitle: '匯入 / 匯出',
        btnClose: '關閉',
        iePlaceholder: '每行一個 API Key，或貼上 JSON 匯出內容\n純文字匯入會使用上方平台；JSON 會保留原資料',
        btnImport: '匯入',
        btnExportAll: '匯出全部',
        kmEmptyTitle: '還沒有 Key',
        kmEmptyHint: '新增你的第一個 API 密鑰，開始管理和檢測',
        kmEmptyCta: '新增第一個 Key',
        // Add Key Modal
        modalAddKeyTitle: '新增 Key',
        labelPlatform: '平台',
        placeholderSelectPlatform: '選擇平台',
        labelApiKeyRequired: 'API 金鑰',
        placeholderApiKey: 'sk-...',
        labelAlias: '別名（可選）',
        placeholderAlias: '方便識別的名稱',
        labelModel2: '模型',
        placeholderModel2: 'gpt-4o-mini',
        btnCancel: '取消',
        btnAdd: '新增',
        // Filter status options
        statusValid: '有效',
        statusInvalid: '無效',
        statusRateLimit: '限流',
        statusUnknown: '未知',

        // ── Key Card ──
        kcModels: '{count} 模型',
        kcNotChecked: '未檢測',

        // ── Key Detail Modal ──
        kdFieldApiKey: 'API 金鑰',
        kdCopyHint: '複製',
        kdFieldAlias: '別名',
        kdPlaceholderAlias: '輸入別名',
        kdFieldPlatform: '平台',
        kdFieldBalance: '餘額',
        kdFieldModel: '模型',
        kdFieldBaseUrl: '基礎 URL',
        kdFieldCreatedAt: '建立時間',
        kdFieldLastChecked: '最近檢測',
        btnEdit: '編輯',
        btnSave: '儲存',
        btnCancelEdit: '取消',
        btnTestConn: '測試連線',
        btnTesting: '測試中...',
        btnSpeedTest: '測速',
        btnSpeedTesting: '測速中...',
        btnFetchModels: '獲取模型',
        btnFetchingModels: '獲取中...',
        btnDelete: '刪除',
        sectionTags: '標籤',
        tagEmptyHint: '暫無標籤，在下方輸入後按 Enter 新增',
        placeholderTag: '輸入標籤名稱...',
        btnAddTag: '新增',
        sectionBalanceHistory: '餘額歷史',
        sectionModels: '可用模型',
        placeholderSearchModel: '搜尋模型...',

        // ── Settings Modal ──
        settingsTitle: '檢測設定',
        settingsSectionRegion: '區域',
        settingsSectionParams: '驗證參數',
        labelThreshold: '最低餘額',
        labelConcurrency: '並發數',
        hintConcurrency: '(1-20)',
        labelMaxTokens: '最大 Token 數',
        labelMaxOutputTokens: '最大輸出 Token',
        labelPrompt: '提示詞',
        // ── Regions ──
        regionWnam: '北美西部',
        regionEnam: '北美東部',
        regionSam: '南美洲',
        regionWeur: '西歐',
        regionEeur: '東歐',
        regionApac: '亞太',
        regionOc: '大洋洲',
        regionAfr: '非洲',
        regionMe: '中東',

        // ── Model Selector Modal ──
        placeholderSearchModelSelector: '搜尋模型...',
        modelCount: '顯示: {visible} / {total}',
        btnCopyAll: '複製全部',

        // ── Details Modal ──
        detailsTitle: '介面返回詳情',
        btnCopyDetails: '複製詳情',
        btnConfirm: '確定',

        // ── Confirmation Modal ──
        confirmTitle: '請確認',
        btnConfirmYes: '確定',
        btnConfirmNo: '取消',

        // ── Custom Select ──
        csNoMatch: '無匹配項',

        // ── Toast titles ──
        toastSuccess: '成功',
        toastError: '錯誤',
        toastWarning: '警告',
        toastInfo: '提示',

        // ── Toast messages (checker store) ──
        toastProcessing: '正在處理 {done} / {total} 個 Key...',
        toastBackendError: '後端錯誤: {msg}',
        toastReconnecting: '連線中斷，正在重試 ({cur}/{max})...',
        toastReconnectFailed: '檢測連線意外關閉，重連失敗，任務已停止。',
        toastNoKey: '請輸入至少一個 API KEY',
        toastKeyLimit: 'Key 數量超過限制（最多 {max} 個），請分批檢測',
        toastDuplicateFiltered: '已過濾 {count} 個重複 Key',
        toastNoDuplicate: '沒有需要檢測的 KEY（已去除重複項）',
        toastStarting: '開始檢測 {count} 個 Key...',
        toastStopped: '檢測已手動停止',
        toastPaused: '檢測已暫停',
        toastResumed: '檢測已恢復',
        toastFinished: '檢測完成！{summary}',
        toastFinishedEmpty: '檢測完成！沒有有效結果。',
        // category names for summary
        catValid: '有效',
        catLowBalance: '低額',
        catZeroBalance: '零額',
        catRateLimit: '限流',
        catInvalid: '無效',
        catDuplicate: '重複',

        // ── Toast messages (KeyInput) ──
        toastOnlyTxt: '僅支援 .txt 文字檔案',
        toastFileTooBig: '檔案過大（最大 {max}MB），目前 {size}',
        toastFileReadFailed: '檔案讀取失敗',
        toastFileParseFailed: '檔案解析失敗: {msg}',
        toastFileEmpty: '檔案內容為空',
        toastFileKeyLimit: 'Key 數量超過限制！檔案包含 {count} 個 Key，最多支援 {max} 個',
        toastImportDone: '導入完成！',
        toastImportSuccessLarge: '匯入成功！共 {count} 個 Key，數量較多，檢測可能需要較長時間',
        toastImportSuccess: '檔案匯入成功！共匯入 {count} 個 Key',
        importProgressReading: '正在讀取 {name} ({size})...',
        importProgressReadingProgress: '正在讀取... {loaded} / {total}',
        importProgressParsing: '正在解析內容...',
        importProgressCleaning: '正在清洗資料...',
        importProgressParsingLine: '正在解析... {cur} / {total} 行',
        importProgressValidating: '正在驗證...',
        importProgressDone: '匯入完成！',

        // ── Toast messages (ApiConfig) ──
        toastNoKeyInput: '請先輸入至少一個有效的KEY',
        toastNoModels: '未能獲取到模型列表',
        toastFetchModelFailed: '獲取模型失敗: {msg}',
        toastAllKeysFailed: '{attempted} KEY 均無法獲取到模型列表',
        toastAllKeysFailedPrefix: '前 {n} 個',
        toastAllKeysFailedAll: '所有',

        // ── Toast messages (ResultPanel) ──
        toastNoCopy: '沒有可複製的 {title}',
        toastCopied: '{title} 已複製到剪貼簿 (共 {count} 個)',
        toastCopyFailed: '複製失敗，請檢查瀏覽器權限',
        toastModelSelected: '已選擇模型: {model}',
        toastModelsCopied: '已複製 {count} 個可見模型ID',
        toastDetailsCopied: '詳情已複製到剪貼簿',
        toastFetchModelsFailed: '獲取模型失敗: {msg}',
        toastNoModelList: '未能獲取到模型列表',

        // ── Toast messages (KeyManager) ──
        toastPleaseEnterKey: '請輸入 API Key',
        toastKeyExists: '該 Key 已存在',
        toastKeyAdded: 'Key 已新增',
        toastNoValidKey: '沒有有效的 Key',
        toastNoNewKeys: '沒有可新增的 Key（可能都已存在）',
        toastImportedCount: '成功匯入 {count} 個 Key',
        toastImportFailed: '匯入失敗: {msg}',
        toastSelectFirst: '請先選擇要刪除的 Key',
        toastDeleted: '已刪除',
        toastCopiedClipboard: '已複製到剪貼簿',
        toastManualCopy: '請手動複製下方內容',

        // ── Toast messages (KeyCard) ──
        toastKcCopied: '已複製到剪貼簿',
        toastKcCopyFailed: '複製失敗',

        // ── Toast messages (KeyDetailModal) ──
        toastKdSaved: '已儲存',
        toastKdTestPassed: '測試通過{balMsg}',
        toastKdTestFailed: '測試失敗: {msg}',
        toastKdTestBackendDown: '測試失敗：後端服務未運行',
        toastKdModelsCount: '獲取到 {count} 個模型',
        toastKdModelsFailed: '獲取模型失敗: {msg}',
        kdSpeedMs: '{ms} ms',
        kdSpeedFailed: '失敗',
        toastKdCopied: '已複製',
        toastKdCopyFailed: '複製失敗',
        toastKdDeleted: '已刪除',
        kdConfirmDelete: '確定刪除這個 Key？',
        kdTestTimeout: '測試超時',
        kdWsConnFailed: 'WebSocket 連線失敗',
        kdBalanceMsg: '，餘額: {balance}',
    },

    'zh-CN': {
        // ── App / Header ──
        appTitle: 'KeyNest',
        tabChecker: '检测台',
        tabKey: 'Key',
        statusChecking: '检测中',
        statusPaused: '已暂停',
        statusIdle: '待命',

        // ── Provider Selector ──
        labelProvider: '提供商',
        labelStream: '流式',
        titleStream: '启用流式检测 (Stream Mode)',
        titleSettings: '检测设置',
        ariaSearchProvider: '搜索提供商',
        ariaProviderList: 'API 提供商列表',

        // ── Api Config ──
        labelBaseUrl: '基础 URL',
        labelModel: '模型',
        placeholderBaseUrl: 'API Base URL',
        placeholderModel: '测试用的模型名称',
        btnFetch: '获取',

        // ── Key Input ──
        labelApiKeys: 'API 密钥',
        btnImportFile: '导入文件',
        btnImporting: '导入中',
        btnClearInput: '清空输入',
        placeholderKeys: '粘贴 API Key，或拖入 .txt 文件。多个 Key 可用逗号、分号或换行分隔。',

        // ── Action Buttons ──
        btnStartCheck: '开始检测',
        btnStop: '停止',
        btnPause: '暂停',
        btnResume: '继续',

        // ── Result Tabs ──
        tabValid: '有效',
        tabLowBalance: '低额',
        tabZeroBalance: '零额',
        tabRateLimit: '限流',
        tabInvalid: '无效',
        tabDuplicate: '重复',

        // ── Result Panel ──
        btnCopy: '复制',
        btnDetails: '详情',
        btnModels: '模型',
        btnCopied: '已复制',
        btnCopyFailed: '失败',
        sortDefault: '默认排序',
        sortBalanceDesc: '余额高',
        sortBalanceAsc: '余额低',
        ariaSort: '排序方式',
        ariaSortOptions: '排序选项',
        placeholderSearch: '在结果中搜索...',
        emptyState: '检测结果将显示在这里',

        // ── Key Manager ──
        btnAddKey: '添加 Key',
        btnImportExport: '导入/导出',
        btnCloudBackup: '云端备份',
        cloudBackupTitle: '云端备份',
        cloudBackupHint: 'Backup Token 相当于你的备份身份。请用「生成」创建长随机码，并在其他设备填入同一 Token 即可恢复。Token 只保存在本机浏览器，请自行妥善保存。',
        labelBackupToken: 'Backup Token',
        placeholderBackupToken: '至少 16 位，建议使用生成的随机码',
        btnGenerateToken: '生成',
        btnCopyToken: '复制 Token',
        btnShowToken: '显示',
        btnHideToken: '隐藏',
        btnCheckBackup: '查询云端',
        btnBackupUpload: '备份到云端',
        btnBackupRestoreMerge: '恢复（合并）',
        btnBackupRestoreReplace: '恢复（覆盖）',
        btnBackupDelete: '删除云端备份',
        btnBackupWorking: '处理中…',
        cloudBackupMetaLine: '云端：{count} 个 Key · 更新于 {time}',
        confirmBackupReplace: '覆盖恢复会清空本机所有 Key 后再写入云端备份，确定继续？',
        confirmBackupDelete: '确定删除此 Token 对应的云端备份？此操作不可恢复。',
        toastBackupTokenGenerated: '已生成 Backup Token，请复制到其他设备',
        toastBackupTokenCopied: 'Token 已复制',
        toastBackupTokenRequired: '请先填写 Backup Token',
        toastBackupTokenTooShort: 'Token 至少需要 {min} 个字符',
        toastBackupEmpty: '本地没有可备份的 Key',
        toastBackupUploaded: '已备份 {count} 个 Key 到云端',
        toastBackupRestoredMerge: '已合并恢复 {count} 个新 Key',
        toastBackupRestoredReplace: '已覆盖恢复 {count} 个 Key',
        toastBackupNoNewKeys: '云端备份中没有可合并的新 Key（可能均已存在）',
        toastBackupDeleted: '云端备份已删除',
        toastBackupMeta: '云端有 {count} 个 Key，更新于 {time}',
        toastBackupInvalid: '云端备份格式无效',
        toastBackupFailed: '云端备份失败: {msg}',
        kmCount: '{filtered} / {total} 个 Key',
        placeholderSearchKm: '搜索 Key、别名、标签...',
        filterAllProviders: '全部平台',
        filterAllStatus: '全部状态',
        sortCreatedAt: '创建时间',
        sortLastChecked: '最近检测',
        sortBalance: '余额',
        sortProvider: '平台',
        sortPrefix: '排序: ',
        titleAsc: '升序',
        titleDesc: '降序',
        batchSelectAll: '全选',
        batchSelected: '已选 {count} 个',
        btnBatchDelete: '批量删除',
        ieTitle: '导入 / 导出',
        btnClose: '关闭',
        iePlaceholder: '每行一个 API Key，或粘贴 JSON 导出内容\n纯文本导入会使用上方平台；JSON 会保留原数据',
        btnImport: '导入',
        btnExportAll: '导出全部',
        kmEmptyTitle: '还没有 Key',
        kmEmptyHint: '添加你的第一个 API 密钥，开始管理和检测',
        kmEmptyCta: '添加第一个 Key',
        // Add Key Modal
        modalAddKeyTitle: '添加 Key',
        labelPlatform: '平台',
        placeholderSelectPlatform: '选择平台',
        labelApiKeyRequired: 'API 密钥',
        placeholderApiKey: 'sk-...',
        labelAlias: '别名（可选）',
        placeholderAlias: '方便识别的名称',
        labelModel2: '模型',
        placeholderModel2: 'gpt-4o-mini',
        btnCancel: '取消',
        btnAdd: '添加',
        // Filter status options
        statusValid: '有效',
        statusInvalid: '无效',
        statusRateLimit: '限流',
        statusUnknown: '未知',

        // ── Key Card ──
        kcModels: '{count} 模型',
        kcNotChecked: '未检测',

        // ── Key Detail Modal ──
        kdFieldApiKey: 'API 密钥',
        kdCopyHint: '复制',
        kdFieldAlias: '别名',
        kdPlaceholderAlias: '输入别名',
        kdFieldPlatform: '平台',
        kdFieldBalance: '余额',
        kdFieldModel: '模型',
        kdFieldBaseUrl: '基础 URL',
        kdFieldCreatedAt: '创建时间',
        kdFieldLastChecked: '最近检测',
        btnEdit: '编辑',
        btnSave: '保存',
        btnCancelEdit: '取消',
        btnTestConn: '测试连接',
        btnTesting: '测试中...',
        btnSpeedTest: '测速',
        btnSpeedTesting: '测速中...',
        btnFetchModels: '获取模型',
        btnFetchingModels: '获取中...',
        btnDelete: '删除',
        sectionTags: '标签',
        tagEmptyHint: '暂无标签，在下方输入后按 Enter 添加',
        placeholderTag: '输入标签名称...',
        btnAddTag: '添加',
        sectionBalanceHistory: '余额历史',
        sectionModels: '可用模型',
        placeholderSearchModel: '搜索模型...',

        // ── Settings Modal ──
        settingsTitle: '检测设置',
        settingsSectionRegion: '区域',
        settingsSectionParams: '验证参数',
        labelThreshold: '最低余额',
        labelConcurrency: '并发数',
        hintConcurrency: '(1-20)',
        labelMaxTokens: '最大 Token 数',
        labelMaxOutputTokens: '最大输出 Token',
        labelPrompt: '提示词',
        // ── Regions ──
        regionWnam: '北美西部',
        regionEnam: '北美东部',
        regionSam: '南美洲',
        regionWeur: '西欧',
        regionEeur: '东欧',
        regionApac: '亚太',
        regionOc: '大洋洲',
        regionAfr: '非洲',
        regionMe: '中东',

        // ── Model Selector Modal ──
        placeholderSearchModelSelector: '搜索模型...',
        modelCount: '显示: {visible} / {total}',
        btnCopyAll: '复制全部',

        // ── Details Modal ──
        detailsTitle: '接口返回详情',
        btnCopyDetails: '复制详情',
        btnConfirm: '确定',

        // ── Confirmation Modal ──
        confirmTitle: '请确认',
        btnConfirmYes: '确定',
        btnConfirmNo: '取消',

        // ── Custom Select ──
        csNoMatch: '无匹配项',

        // ── Toast titles ──
        toastSuccess: '成功',
        toastError: '错误',
        toastWarning: '警告',
        toastInfo: '提示',

        // ── Toast messages (checker store) ──
        toastProcessing: '正在处理 {done} / {total} 个 Key...',
        toastBackendError: '后端错误: {msg}',
        toastReconnecting: '连接断开，正在重试 ({cur}/{max})...',
        toastReconnectFailed: '检测连接意外关闭，重连失败，任务已停止。',
        toastNoKey: '请输入至少一个 API KEY',
        toastKeyLimit: 'Key 数量超过限制（最多 {max} 个），请分批检测',
        toastDuplicateFiltered: '已过滤 {count} 个重复 Key',
        toastNoDuplicate: '没有需要检测的 KEY（已去除重复项）',
        toastStarting: '开始检测 {count} 个 Key...',
        toastStopped: '检测已手动停止',
        toastPaused: '检测已暂停',
        toastResumed: '检测已恢复',
        toastFinished: '检测完成！{summary}',
        toastFinishedEmpty: '检测完成！没有有效结果。',
        catValid: '有效',
        catLowBalance: '低额',
        catZeroBalance: '零额',
        catRateLimit: '限流',
        catInvalid: '无效',
        catDuplicate: '重复',

        // ── Toast messages (KeyInput) ──
        toastOnlyTxt: '仅支持 .txt 文本文件',
        toastFileTooBig: '文件过大（最大 {max}MB），当前 {size}',
        toastFileReadFailed: '文件读取失败',
        toastFileParseFailed: '文件解析失败: {msg}',
        toastFileEmpty: '文件内容为空',
        toastFileKeyLimit: 'Key 数量超过限制！文件包含 {count} 个 Key，最多支持 {max} 个',
        toastImportDone: '导入完成！',
        toastImportSuccessLarge: '导入成功！共 {count} 个 Key，数量较多，检测可能需要较长时间',
        toastImportSuccess: '文件导入成功！共导入 {count} 个 Key',
        importProgressReading: '正在读取 {name} ({size})...',
        importProgressReadingProgress: '正在读取... {loaded} / {total}',
        importProgressParsing: '正在解析内容...',
        importProgressCleaning: '正在清洗数据...',
        importProgressParsingLine: '正在解析... {cur} / {total} 行',
        importProgressValidating: '正在验证...',
        importProgressDone: '导入完成！',

        // ── Toast messages (ApiConfig) ──
        toastNoKeyInput: '请先输入至少一个有效的KEY',
        toastNoModels: '未能获取到模型列表',
        toastFetchModelFailed: '获取模型失败: {msg}',
        toastAllKeysFailed: '{attempted} KEY 均无法获取到模型列表',
        toastAllKeysFailedPrefix: '前 {n} 个',
        toastAllKeysFailedAll: '所有',

        // ── Toast messages (ResultPanel) ──
        toastNoCopy: '没有可复制的 {title}',
        toastCopied: '{title} 已复制到剪贴板 (共 {count} 个)',
        toastCopyFailed: '复制失败，请检查浏览器权限',
        toastModelSelected: '已选择模型: {model}',
        toastModelsCopied: '已复制 {count} 个可见模型ID',
        toastDetailsCopied: '详情已复制到剪贴板',
        toastFetchModelsFailed: '获取模型失败: {msg}',
        toastNoModelList: '未能获取到模型列表',

        // ── Toast messages (KeyManager) ──
        toastPleaseEnterKey: '请输入 API Key',
        toastKeyExists: '该 Key 已存在',
        toastKeyAdded: 'Key 已添加',
        toastNoValidKey: '没有有效的 Key',
        toastNoNewKeys: '没有可新增的 Key（可能都已存在）',
        toastImportedCount: '成功导入 {count} 个 Key',
        toastImportFailed: '导入失败: {msg}',
        toastSelectFirst: '请先选择要删除的 Key',
        toastDeleted: '已删除',
        toastCopiedClipboard: '已复制到剪贴板',
        toastManualCopy: '请手动复制下方内容',

        // ── Toast messages (KeyCard) ──
        toastKcCopied: '已复制到剪贴板',
        toastKcCopyFailed: '复制失败',

        // ── Toast messages (KeyDetailModal) ──
        toastKdSaved: '已保存',
        toastKdTestPassed: '测试通过{balMsg}',
        toastKdTestFailed: '测试失败: {msg}',
        toastKdTestBackendDown: '测试失败：后端服务未运行',
        toastKdModelsCount: '获取到 {count} 个模型',
        toastKdModelsFailed: '获取模型失败: {msg}',
        kdSpeedMs: '{ms} ms',
        kdSpeedFailed: '失败',
        toastKdCopied: '已复制',
        toastKdCopyFailed: '复制失败',
        toastKdDeleted: '已删除',
        kdConfirmDelete: '确定删除这个 Key？',
        kdTestTimeout: '测试超时',
        kdWsConnFailed: 'WebSocket 连接失败',
        kdBalanceMsg: '，余额: {balance}',
    },

    'en': {
        // ── App / Header ──
        appTitle: 'KeyNest',
        tabChecker: 'Checker',
        tabKey: 'Key',
        statusChecking: 'Checking',
        statusPaused: 'Paused',
        statusIdle: 'Idle',

        // ── Provider Selector ──
        labelProvider: 'Provider',
        labelStream: 'Stream',
        titleStream: 'Enable Stream Mode',
        titleSettings: 'Settings',
        ariaSearchProvider: 'Search provider',
        ariaProviderList: 'API provider list',

        // ── Api Config ──
        labelBaseUrl: 'Base URL',
        labelModel: 'Model',
        placeholderBaseUrl: 'API Base URL',
        placeholderModel: 'Model for validation',
        btnFetch: 'Fetch',

        // ── Key Input ──
        labelApiKeys: 'API Keys',
        btnImportFile: 'Import File',
        btnImporting: 'Importing',
        btnClearInput: 'Clear',
        placeholderKeys: 'Paste API Keys, or drop a .txt file. Separate multiple keys with commas, semicolons, or newlines.',

        // ── Action Buttons ──
        btnStartCheck: 'Start Check',
        btnStop: 'Stop',
        btnPause: 'Pause',
        btnResume: 'Resume',

        // ── Result Tabs ──
        tabValid: 'Valid',
        tabLowBalance: 'Low Bal.',
        tabZeroBalance: 'Zero Bal.',
        tabRateLimit: 'Rate Ltd.',
        tabInvalid: 'Invalid',
        tabDuplicate: 'Duplicate',

        // ── Result Panel ──
        btnCopy: 'Copy',
        btnDetails: 'Details',
        btnModels: 'Models',
        btnCopied: 'Copied',
        btnCopyFailed: 'Failed',
        sortDefault: 'Default',
        sortBalanceDesc: 'Balance ↓',
        sortBalanceAsc: 'Balance ↑',
        ariaSort: 'Sort by',
        ariaSortOptions: 'Sort options',
        placeholderSearch: 'Search results...',
        emptyState: 'Results will appear here',

        // ── Key Manager ──
        btnAddKey: 'Add Key',
        btnImportExport: 'Import/Export',
        btnCloudBackup: 'Cloud Backup',
        cloudBackupTitle: 'Cloud Backup',
        cloudBackupHint: 'A Backup Token is your backup identity. Generate a long random token, then enter the same token on other devices to restore. The token is stored only in this browser — keep it safe yourself.',
        labelBackupToken: 'Backup Token',
        placeholderBackupToken: 'At least 16 chars; use Generate for a strong token',
        btnGenerateToken: 'Generate',
        btnCopyToken: 'Copy Token',
        btnShowToken: 'Show',
        btnHideToken: 'Hide',
        btnCheckBackup: 'Check Cloud',
        btnBackupUpload: 'Backup to Cloud',
        btnBackupRestoreMerge: 'Restore (Merge)',
        btnBackupRestoreReplace: 'Restore (Replace)',
        btnBackupDelete: 'Delete Cloud Backup',
        btnBackupWorking: 'Working…',
        cloudBackupMetaLine: 'Cloud: {count} keys · updated {time}',
        confirmBackupReplace: 'Replace will clear all local keys, then write the cloud backup. Continue?',
        confirmBackupDelete: 'Delete the cloud backup for this token? This cannot be undone.',
        toastBackupTokenGenerated: 'Backup Token generated — copy it to other devices',
        toastBackupTokenCopied: 'Token copied',
        toastBackupTokenRequired: 'Please enter a Backup Token first',
        toastBackupTokenTooShort: 'Token must be at least {min} characters',
        toastBackupEmpty: 'No local keys to back up',
        toastBackupUploaded: 'Backed up {count} key(s) to the cloud',
        toastBackupRestoredMerge: 'Merged {count} new key(s) from cloud',
        toastBackupRestoredReplace: 'Restored {count} key(s) (replaced local)',
        toastBackupNoNewKeys: 'No new keys to merge (they may already exist locally)',
        toastBackupDeleted: 'Cloud backup deleted',
        toastBackupMeta: 'Cloud has {count} key(s), updated {time}',
        toastBackupInvalid: 'Invalid cloud backup format',
        toastBackupFailed: 'Cloud backup failed: {msg}',
        kmCount: '{filtered} / {total} Keys',
        placeholderSearchKm: 'Search key, alias, tag...',
        filterAllProviders: 'All Providers',
        filterAllStatus: 'All Status',
        sortCreatedAt: 'Created At',
        sortLastChecked: 'Last Checked',
        sortBalance: 'Balance',
        sortProvider: 'Provider',
        sortPrefix: 'Sort: ',
        titleAsc: 'Ascending',
        titleDesc: 'Descending',
        batchSelectAll: 'Select All',
        batchSelected: '{count} selected',
        btnBatchDelete: 'Delete Selected',
        ieTitle: 'Import / Export',
        btnClose: 'Close',
        iePlaceholder: 'One API Key per line, or paste exported JSON\nPlain-text import uses the provider above; JSON keeps its original data',
        btnImport: 'Import',
        btnExportAll: 'Export All',
        kmEmptyTitle: 'No Keys Yet',
        kmEmptyHint: 'Add your first API key to start managing and checking',
        kmEmptyCta: 'Add First Key',
        // Add Key Modal
        modalAddKeyTitle: 'Add Key',
        labelPlatform: 'Provider',
        placeholderSelectPlatform: 'Select provider',
        labelApiKeyRequired: 'API Key',
        placeholderApiKey: 'sk-...',
        labelAlias: 'Alias (optional)',
        placeholderAlias: 'A name to identify this key',
        labelModel2: 'Model',
        placeholderModel2: 'gpt-4o-mini',
        btnCancel: 'Cancel',
        btnAdd: 'Add',
        // Filter status options
        statusValid: 'Valid',
        statusInvalid: 'Invalid',
        statusRateLimit: 'Rate Limited',
        statusUnknown: 'Unknown',

        // ── Key Card ──
        kcModels: '{count} models',
        kcNotChecked: 'Not checked',

        // ── Key Detail Modal ──
        kdFieldApiKey: 'API Key',
        kdCopyHint: 'Copy',
        kdFieldAlias: 'Alias',
        kdPlaceholderAlias: 'Enter alias',
        kdFieldPlatform: 'Provider',
        kdFieldBalance: 'Balance',
        kdFieldModel: 'Model',
        kdFieldBaseUrl: 'Base URL',
        kdFieldCreatedAt: 'Created At',
        kdFieldLastChecked: 'Last Checked',
        btnEdit: 'Edit',
        btnSave: 'Save',
        btnCancelEdit: 'Cancel',
        btnTestConn: 'Test Connection',
        btnTesting: 'Testing...',
        btnSpeedTest: 'Speed Test',
        btnSpeedTesting: 'Testing...',
        btnFetchModels: 'Fetch Models',
        btnFetchingModels: 'Fetching...',
        btnDelete: 'Delete',
        sectionTags: 'Tags',
        tagEmptyHint: 'No tags yet. Type below and press Enter to add.',
        placeholderTag: 'Enter tag name...',
        btnAddTag: 'Add',
        sectionBalanceHistory: 'Balance History',
        sectionModels: 'Available Models',
        placeholderSearchModel: 'Search models...',

        // ── Settings Modal ──
        settingsTitle: 'Check Settings',
        settingsSectionRegion: 'Region',
        settingsSectionParams: 'Validation Params',
        labelThreshold: 'Min Balance',
        labelConcurrency: 'Concurrency',
        hintConcurrency: '(1-20)',
        labelMaxTokens: 'Max Tokens',
        labelMaxOutputTokens: 'Max Output Tokens',
        labelPrompt: 'Prompt',
        // ── Regions ──
        regionWnam: 'NA West',
        regionEnam: 'NA East',
        regionSam: 'South America',
        regionWeur: 'Western Europe',
        regionEeur: 'Eastern Europe',
        regionApac: 'Asia Pacific',
        regionOc: 'Oceania',
        regionAfr: 'Africa',
        regionMe: 'Middle East',

        // ── Model Selector Modal ──
        placeholderSearchModelSelector: 'Search models...',
        modelCount: 'Showing: {visible} / {total}',
        btnCopyAll: 'Copy All',

        // ── Details Modal ──
        detailsTitle: 'Response Details',
        btnCopyDetails: 'Copy Details',
        btnConfirm: 'OK',

        // ── Confirmation Modal ──
        confirmTitle: 'Confirm',
        btnConfirmYes: 'Confirm',
        btnConfirmNo: 'Cancel',

        // ── Custom Select ──
        csNoMatch: 'No matches',

        // ── Toast titles ──
        toastSuccess: 'Success',
        toastError: 'Error',
        toastWarning: 'Warning',
        toastInfo: 'Info',

        // ── Toast messages (checker store) ──
        toastProcessing: 'Processing {done} / {total} keys...',
        toastBackendError: 'Backend error: {msg}',
        toastReconnecting: 'Disconnected, retrying ({cur}/{max})...',
        toastReconnectFailed: 'Connection lost. Reconnect failed. Task stopped.',
        toastNoKey: 'Please enter at least one API KEY',
        toastKeyLimit: 'Key limit exceeded (max {max}). Please split into batches.',
        toastDuplicateFiltered: '{count} duplicate key(s) filtered',
        toastNoDuplicate: 'No keys to check (all duplicates removed)',
        toastStarting: 'Starting check for {count} key(s)...',
        toastStopped: 'Check stopped manually',
        toastPaused: 'Check paused',
        toastResumed: 'Check resumed',
        toastFinished: 'Done! {summary}',
        toastFinishedEmpty: 'Done! No valid results.',
        catValid: 'Valid',
        catLowBalance: 'Low Bal.',
        catZeroBalance: 'Zero Bal.',
        catRateLimit: 'Rate Ltd.',
        catInvalid: 'Invalid',
        catDuplicate: 'Dup.',

        // ── Toast messages (KeyInput) ──
        toastOnlyTxt: 'Only .txt files are supported',
        toastFileTooBig: 'File too large (max {max}MB), current {size}',
        toastFileReadFailed: 'File read failed',
        toastFileParseFailed: 'File parse failed: {msg}',
        toastFileEmpty: 'File is empty',
        toastFileKeyLimit: 'Too many keys! File has {count} keys, max is {max}',
        toastImportDone: 'Import complete!',
        toastImportSuccessLarge: 'Imported {count} keys. Large batch — checking may take a while.',
        toastImportSuccess: 'File imported! {count} key(s) loaded.',
        importProgressReading: 'Reading {name} ({size})...',
        importProgressReadingProgress: 'Reading... {loaded} / {total}',
        importProgressParsing: 'Parsing content...',
        importProgressCleaning: 'Cleaning data...',
        importProgressParsingLine: 'Parsing... {cur} / {total} lines',
        importProgressValidating: 'Validating...',
        importProgressDone: 'Import complete!',

        // ── Toast messages (ApiConfig) ──
        toastNoKeyInput: 'Please enter at least one valid API KEY',
        toastNoModels: 'Could not retrieve model list',
        toastFetchModelFailed: 'Failed to fetch models: {msg}',
        toastAllKeysFailed: '{attempted} KEY(s) failed to fetch models',
        toastAllKeysFailedPrefix: 'First {n}',
        toastAllKeysFailedAll: 'All',

        // ── Toast messages (ResultPanel) ──
        toastNoCopy: 'No {title} keys to copy',
        toastCopied: '{title} copied to clipboard ({count} keys)',
        toastCopyFailed: 'Copy failed. Check browser permissions.',
        toastModelSelected: 'Model selected: {model}',
        toastModelsCopied: '{count} visible model ID(s) copied',
        toastDetailsCopied: 'Details copied to clipboard',
        toastFetchModelsFailed: 'Failed to fetch models: {msg}',
        toastNoModelList: 'Could not retrieve model list',

        // ── Toast messages (KeyManager) ──
        toastPleaseEnterKey: 'Please enter an API Key',
        toastKeyExists: 'This Key already exists',
        toastKeyAdded: 'Key added',
        toastNoValidKey: 'No valid keys found',
        toastNoNewKeys: 'No new keys to import',
        toastImportedCount: '{count} key(s) imported',
        toastImportFailed: 'Import failed: {msg}',
        toastSelectFirst: 'Please select keys to delete first',
        toastDeleted: 'Deleted',
        toastCopiedClipboard: 'Copied to clipboard',
        toastManualCopy: 'Please copy the content below manually',

        // ── Toast messages (KeyCard) ──
        toastKcCopied: 'Copied to clipboard',
        toastKcCopyFailed: 'Copy failed',

        // ── Toast messages (KeyDetailModal) ──
        toastKdSaved: 'Saved',
        toastKdTestPassed: 'Test passed{balMsg}',
        toastKdTestFailed: 'Test failed: {msg}',
        toastKdTestBackendDown: 'Test failed: backend not running',
        toastKdModelsCount: '{count} model(s) fetched',
        toastKdModelsFailed: 'Failed to fetch models: {msg}',
        kdSpeedMs: '{ms} ms',
        kdSpeedFailed: 'Failed',
        toastKdCopied: 'Copied',
        toastKdCopyFailed: 'Copy failed',
        toastKdDeleted: 'Deleted',
        kdConfirmDelete: 'Delete this Key?',
        kdTestTimeout: 'Test timed out',
        kdWsConnFailed: 'WebSocket connection failed',
        kdBalanceMsg: ', balance: {balance}',
    },
};

/**
 * @description 翻译函数，根据当前语言返回对应文案。
 * 支持简单的占位符替换，如 {count}。
 * @param {string} key - 翻译键。
 * @param {Record<string, string|number>} [params] - 占位符参数。
 * @returns {string} - 翻译后的文案。
 */
export function t(key, params) {
    const lang = currentLang.value;
    const dict = messages[lang] || messages['zh-TW'];
    let text = dict[key] ?? messages['zh-TW'][key] ?? key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

/**
 * @description 响应式翻译函数（computed 包装），用于模板中直接调用。
 * 当语言切换时自动更新。
 * @param {string} key - 翻译键。
 * @param {Record<string, string|number>} [params] - 占位符参数。
 * @returns {ComputedRef<string>}
 */
export function useT(key, params) {
    return computed(() => t(key, params));
}
