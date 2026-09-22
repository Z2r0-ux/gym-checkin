# 训练打卡 · GitHub Pages 部署版

这是一个纯静态网页，不需要服务器和数据库。

## GitHub Pages 部署

1. 在 GitHub 新建一个仓库，例如 `gym-checkin`
2. 把这个压缩包里的所有文件上传到仓库根目录
3. 打开仓库：
   - Settings
   - Pages
4. 在 `Build and deployment` 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. 保存后，GitHub 会生成访问地址，通常类似：
   `https://你的用户名.github.io/gym-checkin/`

## iPhone 添加到主屏幕

1. 用 Safari 打开 GitHub Pages 地址
2. 点击 Safari 底部的“分享”
3. 选择“添加到主屏幕”
4. 名称可以保留为“训练打卡”
5. 以后直接从桌面图标打开

## 数据保存

- 训练数据默认保存在 iPhone Safari / Web App 的本地存储中
- 建议定期在“更多 → 导出训练记录”里导出 JSON 备份
- 换手机或清理 Safari 数据前，先导出
- GitHub Pages 更新网页文件，不会主动清除浏览器本地训练数据

## 更新训练计划

以后如果只调整重量、组数或动作，可以直接修改 `index.html` 内的 `PLAN` 数据。
重新上传到 GitHub 后，网页会自动更新。

如果主屏幕版本短时间内没有更新：
- 完全关闭训练打卡 App 后重新打开
- 或在 Safari 中刷新一次网页
