# 训练打卡

这是一个部署在 GitHub Pages 上的个人训练打卡 PWA。目前定位是 **Personalized Single-User MVP**：界面和训练流程可复用，但默认训练方案与每日目标仍针对当前用户配置。

## 当前结构

```text
gym-checkin/
├─ index.html                 # 页面结构
├─ styles.css                 # 界面样式
├─ app.js                     # 打卡、计时、历史、导入导出等应用逻辑
├─ data/
│  ├─ profile.js              # 用户阶段、每日目标、饮食原则、本地存储键
│  └─ program.js              # 当前训练计划、动作、重量、组数、RIR、休息时间
├─ manifest.webmanifest       # PWA 配置
├─ sw.js                      # 离线缓存
├─ apple-touch-icon.png
├─ icon-192.png
└─ icon-512.png
```

## 解耦原则

- `index.html` 不再保存个人训练数据和整套训练计划。
- `profile.js` 只保存个人配置和目标。
- `program.js` 只保存训练方案。
- `app.js` 只负责应用行为和本地数据读写。
- 训练记录仍保存在浏览器 `localStorage` 中。

## 数据兼容

本次重构继续使用原来的本地存储键：

```text
gym_mobile_v3
```

因此已有训练记录、当前重量、每组次数、RIR、完成状态和历史记录会继续读取，不需要重新导入。

导出的 JSON 现在附带 `schemaVersion`、`profileId` 和 `exportedAt`，但仍兼容旧版导出文件。

## GitHub Pages

仓库继续从 `main` 分支根目录部署，不需要修改 Pages 设置。

修改 `main` 后 GitHub Pages 会重新发布。iPhone 主屏幕版本由 `sw.js` 提供离线缓存；本次缓存版本已经升级，重新打开应用后会逐步切换到新版本。

## 下一阶段

当前结构已经为多用户做好第一步准备。后续可以在不重写界面的情况下，把 `profile.js` 和 `program.js` 改为按用户加载，并再接入登录与云端数据同步。
