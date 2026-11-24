# 成语记忆

「成语记忆」是一个纯静态的中文成语学习页：翻转卡片复习、成语 CRUD、自定义近义成语组，以及基于内置词库的离线近义推荐。界面风格参考 [NDKY-English-1000word](https://github.com/2817764844/NDKY-English-1000word) 的浅色学习应用布局，但内容与词库均为成语专用，不依赖任何付费 AI API。

## 功能

1. **成语 CRUD**：可添加单个成语，或一次录入 2 条以上近义成语为一组；释义会在输入成语后从内嵌词库自动填充，可手动修改。
2. **卡片复习**：网格卡片默认只显示成语，点击翻转查看释义与例句。
3. **我的近义组**：展示你保存的近义成语分组。
4. **词库近义推荐**：内置约 80 条常见成语，每条预计算 2–4 个近义成语；也可在用户成语释义不明确时，用本地字符重叠做简单匹配。全部离线可用。

用户数据保存在浏览器 `localStorage`（键名 `chengyu-memory-v1`），刷新页面不会丢失。

## 本地运行

无需构建步骤，任意静态服务器或直接打开 HTML 即可（推荐用本地服务器，避免部分浏览器对 `file://` 的限制）。

```bash
# 克隆仓库
git clone https://github.com/2817764844/chengyu-memory.git
cd chengyu-memory

# 方式一：Python
python3 -m http.server 8080

# 方式二：Node（若已安装 npx）
npx --yes serve .

# 浏览器访问 http://localhost:8080
```

若修改了 `data/idiom-clusters.json`，请重新生成内置词库：

```bash
node tools/build-bank.js
```

## GitHub Pages 发布

本仓库为 **纯静态站点**，站点根目录即为仓库根目录（包含 `index.html`）。

1. 打开仓库 **Settings → Pages**。
2. **Build and deployment → Source** 选择 **Deploy from a branch**。
3. **Branch** 选择 `main`（或你的默认分支），文件夹选 **`/ (root)`**。
4. 保存后等待部署完成，访问：`https://2817764844.github.io/chengyu-memory/`

若使用自定义域名，在 Pages 设置中填写域名，并按要求添加 DNS 记录即可。

## 项目结构

| 文件 | 说明 |
|------|------|
| `index.html` | 页面骨架与四个主视图 |
| `styles.css` | 样式（浅色学习应用风格） |
| `app.js` | 交互与视图逻辑 |
| `storage.js` | `localStorage` 读写 |
| `dictionary.js` | 内置词库查询 |
| `similar-matcher.js` | 离线近义推荐 |
| `chengyu-bank.js` / `chengyu-similar.js` | 由 `tools/build-bank.js` 生成的内置数据 |
| `data/idiom-clusters.json` | 词库与近义组的人工源数据 |

## 许可与说明

- 不包含 API Key，运行时不需要联网（除你主动打开 Pages 托管的站点外）。
- 参考仓库 [NDKY-English-1000word](https://github.com/2817764844/NDKY-English-1000word) 仅作 UI 思路参考，未复制其英语词库或相关代码。