# 小肥鱼桌面宠物（desktop-pet）

不是令牌皮肤，而是一只真正浮在 Windows 桌面上的养成宠物：透明无边框窗口、置顶、可拖动；使用上游 dsh-pet 的真实逐帧动作，会待机、进食、玩耍、睡觉和干活。收起福地后的入口也已替换成这只宠物。

参考了：

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（DSH 桌面宠物插件：透明动画、多开、拖拽、自定义素材）
- [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)（Python 桌面端版本）

## 安装包（推荐给普通用户）

构建：

```powershell
powershell -ExecutionPolicy Bypass -File desktop-pet\build-installer.ps1
```

产物：`artifacts/installer/DSH-Pet-Setup-0.1.3.exe`

- 按用户安装到 `%LOCALAPPDATA%\Programs\DSH Pet`，不需要管理员权限
- 默认创建**桌面快捷方式**
- 可选「开机自动启动」
- 控制面板/设置里可正常卸载
- 单实例：开机启动和桌面快捷方式同时存在也不会出现两只

构建依赖：Python + Pillow + PyInstaller + Inno Setup 6（本机已装）。

## 启动

双击 `start-pet.cmd`，或：

```powershell
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" desktop-pet\pet.py --workspace .
```

自带运行时：不需要安装 Python / Pillow，脚本会优先使用 DSH 的内置 Python；找不到时回退到系统 `pythonw`。

## 互动

桌面窗口**只显示角色本体**：没有气泡、按钮和常驻数值面板。

| 操作 | 效果 |
| --- | --- |
| 左键单击 | 摸摸，心情 +7、经验 +2，冒一颗心 |
| 空闲漫游 | 每隔 18-28 秒小跑一段（80-220px），停下后再随机做待机动作 |
| 左键拖动 | 把宠物拖到桌面任意位置（位置会记住，并夹在屏幕内） |
| 双击 | 唤醒 DSH 并把右侧福地展开到首页；DSH 没启动时会自动启动 |
| 右键 | 喂食 / 陪玩 / 摸摸 / 休息（睡 10 分钟）/ 动作预览 / 打开 DSH / 查看状态 / 退出 |
| 右键 → 动作预览 | 逐项播放 19 个行为动作（点击回应 / 睡觉 / 工作 / 拖拽 / 待机），方便验证 |
| 快捷键 F / P / M / R | 喂食 / 陪玩 / 摸摸 / 休息（S 查看状态，D 打开 DSH） |

完整数值、成长条和四个互动按钮在 DSH 的「设置 → 宠物」页里，桌面端保持干净。

随机性：点击回应和工作状态不会连续抽到同一个；待机每 8-30 秒按精力/心情加权抽一个动作（困了更爱打哈欠，精力足更容易伸懒腰）；空闲还会每隔 18-28 秒小跑一段再停下，不会像固定循环那样机械重复。

## 养成规则

- 饱食度会随时间下降；饿到 0 时心情下降更快。
- 精力会缓慢恢复；右键「休息」会进入 10 分钟睡眠，期间精力恢复更快，点击宠物可提前唤醒。
- 喂食 +26 饱食、+6 经验；陪玩 +18 心情、+8 经验；摸摸 +2 经验。
- 每完成 1 个 DSH 团队任务（读取工作区 `.agent-teams/**/team.json`），宠物 +12 经验、+4 心情。
- 阶段：幼鲸（Lv1-2）→ 小鲸娘（Lv3-4）→ 鲸鱼娘（Lv5-7）→ 大鲸娘（Lv8+），体型跟着变大。
- 离线最多结算 12 小时，不会一觉醒来饿成鱼干。

存档：`%APPDATA%\dsh-pet\state.json`。

## 自检 / 重置

```powershell
python desktop-pet\pet.py --check --workspace .
python desktop-pet\pet.py --reset
```

## 复刻程度

- **桌面壳/交互**：按 dsh-pet 的形态复刻——透明、置顶、可拖拽、右键互动、状态持久化。
- **动画**：使用上游 dsh-pet 的 webm 原始动作，抽取为逐帧 PNG（去黑底、裁切、缩放），共 25 组：
  - 核心互动：idle / feed / play / sleep / work / pet
  - 点击回应：元气挥手、开心跃动、害羞惊讶、傲娇生气、挠痒咯咯笑
  - 睡觉链路：开始 / 循环 / 起来
  - 工作状态：踱步张望、垂头叹气、忙碌点按、思考冒泡、清点归档、雀跃庆祝
  - 拖拽反馈：被鼠标拖拽悬空
  - 随机待机：东张西望、超大伸懒腰、哈欠连天、待机呼吸
  - 收起福地的入口使用 idle 静态帧 + CSS 浮动，替代原来的令牌，避免 GIF 循环截断造成的跑停。
- **素材**：`assets/anim-*` 与 `assets/whale-girl.png` 均来自你提供的 dsh-pet 角色素材；上游为 MIT/BSD 授权的同人素材，发布前请确认授权与署名。

## 说明

这是独立桌面进程，通过 `tkinter` + Pillow 绘制，不依赖 DSH 客户端；DSH 插件里的「设置 → 宠物」页使用同一套养成规则（数值/阶段/互动一致，存档各自独立）。后续可以接托盘、开机自启、逐帧动作和换装。
