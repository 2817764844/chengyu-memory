# 成语记忆

「成语记忆」是一个纯静态的中文成语学习页：卡片复习、成语 CRUD、自定义近义成语组、内置词库近义推荐，并可选用 **邮箱密码账号 + Supabase 云同步** 与 **安卓 App 内更新**。

## 功能

1. **成语 CRUD**：单个成语或近义成语组；释义从内嵌词库自动填充，可编辑。
2. **卡片复习**：等高卡片网格，点击在弹窗中查看释义与近义。
3. **我的近义组**：分组与成员 chip。
4. **词库近义**：内置约 80 条成语，每条预计算 2–4 个近义。
5. **我的**：可选登录/注册、云同步成语与近义组、网页/安卓版本与「检查更新」（安卓可侧载 APK）。

未登录时数据保存在 `localStorage`（`chengyu-memory-v1`）。登录后与云端表 `chengyu_state` 合并同步（与 CET-4 的 `study_state` 独立）。

## 本地运行（网页）

```bash
git clone https://github.com/2817764844/chengyu-memory.git
cd chengyu-memory
python3 -m http.server 8080
# http://localhost:8080
```

词库源数据变更后：`node tools/build-bank.js`

## 云同步（Supabase）

- 配置见根目录 `cloud-config.js`（与 [CET-4 项目](https://github.com/2817764844/NDKY-English-1000word) 共用 Supabase 实例，仅 **anon key**，无 service_role）。
- 新建表 SQL：`supabase/chengyu_state.sql`（RLS：用户仅读写自己的行）。
- 在 [Supabase 控制台](https://supabase.com/dashboard/project/sfairjuuslgvllzurkqx) 的 SQL Editor 中执行该文件即可（本仓库已在开发环境应用过一次）。

## GitHub Pages

1. **Settings → Pages → Deploy from a branch**
2. 分支 `main`，文件夹 **`/ (root)`**
3. 访问：`https://2817764844.github.io/chengyu-memory/`

## 安卓 App（Capacitor）

- **applicationId**：`com.lostlisa.chengyumemory`
- **versionName** `1.0` / **versionCode** `1`，竖屏，边到边安全区由 `MainActivity` + `html.native-safe-area` 处理。
- 更新：从本仓库 GitHub Releases 拉取，资产名须匹配 `chengyu-memory-{versionName}-{versionCode}.apk`。

### 构建 release APK（本机）

```bash
npm install
npm run sync:www
npx cap sync android

# 勿将 keystore 提交仓库：在 android/keystore.properties 填写（可参考 android/keystore.properties.example）
cd android && ./gradlew assembleRelease
```

输出：`android/app/build/outputs/apk/release/app-release.apk`（发布时请重命名为 `chengyu-memory-1.0-1.apk`）。

## 项目结构

| 路径 | 说明 |
|------|------|
| `app.js` / `index.html` / `styles.css` | 主应用 UI |
| `storage.js` / `chengyu-sync.js` | 本机存储与云合并 |
| `account.js` / `cloud-config.js` | 账号与 Supabase |
| `update-check.js` / `update.js` | 更新检查（网页逻辑 + 安卓弹窗） |
| `android/` | Capacitor 安卓工程（含 `ChengyuUpdatePlugin`） |
| `supabase/chengyu_state.sql` | 云表与 RLS |

参考仓库 [NDKY-English-1000word](https://github.com/2817764844/NDKY-English-1000word) 仅作账号/同步/更新实现参考，未修改该仓库。