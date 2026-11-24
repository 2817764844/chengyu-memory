/* 从 GitHub Releases 挑选成语记忆 APK（网页与安卓共用）。 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ChengyuUpdateCheck = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ASSET_NAME = /^chengyu-memory-(\d+\.\d+(?:\.\d+)?)-([1-9]\d*)\.apk$/i;
  const RELEASES_URL =
    "https://api.github.com/repos/2817764844/chengyu-memory/releases?per_page=30";
  const PAGE_VERSION_NAME = "1.0";

  function parseAssetName(name) {
    const match = ASSET_NAME.exec(String(name || "").trim());
    if (!match) {
      return null;
    }
    const versionCode = Number(match[2]);
    if (!Number.isSafeInteger(versionCode) || versionCode <= 0) {
      return null;
    }
    return { versionName: match[1], versionCode };
  }

  function isReleaseDownloadUrl(value) {
    try {
      const url = new URL(String(value));
      return (
        url.protocol === "https:" &&
        url.hostname.toLowerCase() === "github.com" &&
        url.pathname.includes("/releases/download/")
      );
    } catch {
      return false;
    }
  }

  function currentVersionCode(current) {
    if (
      !current ||
      current.versionCode === undefined ||
      current.versionCode === null ||
      current.versionCode === ""
    ) {
      return null;
    }
    const code = Number(current.versionCode);
    if (!Number.isSafeInteger(code) || code < 0) {
      return null;
    }
    return code;
  }

  function selectUpdate(releases, current) {
    const installed = currentVersionCode(current);
    if (installed === null || !Array.isArray(releases)) {
      return null;
    }
    let best = null;
    releases.forEach((release) => {
      if (!release || release.draft || release.prerelease) {
        return;
      }
      const assets = Array.isArray(release.assets) ? release.assets : [];
      assets.forEach((asset) => {
        const parsed = parseAssetName(asset && asset.name);
        const downloadUrl = asset && asset.browser_download_url;
        if (!parsed || parsed.versionCode <= installed || !isReleaseDownloadUrl(downloadUrl)) {
          return;
        }
        if (!best || parsed.versionCode > best.versionCode) {
          best = {
            versionName: parsed.versionName,
            versionCode: parsed.versionCode,
            downloadUrl,
          };
        }
      });
    });
    return best;
  }

  function formatVersion(current) {
    const code = currentVersionCode(current);
    if (!current || current.ok === false || !current.versionName || code === null) {
      return "";
    }
    return `${current.versionName}（${code}）`;
  }

  function describeManualCheck(input) {
    const source = input || {};
    if (source.platform !== "android") {
      return {
        status: "web",
        message: "这是网页版。刷新页面即可使用最新内容。浏览器不能安装安卓包。",
      };
    }
    const installed = formatVersion(source.current);
    if (!installed) {
      return { status: "failed", message: "检查更新失败，没有读到当前安装版本。" };
    }
    if (source.remoteOk !== true || !Array.isArray(source.releases)) {
      return { status: "failed", message: "检查更新失败。请检查网络后再试。" };
    }
    const update = selectUpdate(source.releases, source.current);
    if (!update) {
      return { status: "latest", message: `已经是最新版本 ${installed}。` };
    }
    return {
      status: "available",
      message: `发现新版本 ${update.versionName}（${update.versionCode}）。`,
      update,
    };
  }

  return {
    PAGE_VERSION_NAME,
    RELEASES_URL,
    parseAssetName,
    selectUpdate,
    formatVersion,
    describeManualCheck,
  };
});