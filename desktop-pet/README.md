# 小肥鱼桌面宠物（desktop-pet）

不是令牌皮肤，而是一只真正浮在 Windows 桌面上的养成宠物：透明无边框窗口、置顶、可拖动；使用上游 dsh-pet 的真实逐帧动作，会待机、进食、玩耍、睡觉和干活。收起福地后的入口也已替换成这只宠物。

参考了：

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（DSH 桌面宠物插件：透明动画、多开、拖拽、自定义素材）
- [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)（Python 桌面端版本）

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
| 左键拖动 | 把宠物拖到桌面任意位置（位置会记住，并夹在屏幕内） |
| 双击 | 陪玩，心情 +18、精力 -12、经验 +8 |
| 右键 | 喂食 / 陪玩 / 摸摸 / 休息 / 查看状态 / 退出 |
| 快捷键 F / P / M / R | 喂食 / 陪玩 / 摸摸 / 休息（S 查看状态） |

完整数值、成长条和四个互动按钮在 DSH 的「设置 → 宠物」页里，桌面端保持干净。

## 养成规则

- 饱食度会随时间下降；饿到 0 时心情下降更快。
- 精力会缓慢恢复，也可以右键「休息」。
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
- **动画**：使用上游 dsh-pet 的 webm 原始动作，抽取为逐帧 PNG（去黑底、裁切、缩放）：idle / feed / play / sleep / work / pet 六组。桌面宠物按状态切换动画；收起福地的入口直接循环 idle 动画，替代原来的令牌。
- **素材**：`assets/anim-*` 与 `assets/whale-girl.png` 均来自你提供的 dsh-pet 角色素材；上游为 MIT/BSD 授权的同人素材，发布前请确认授权与署名。

## 说明

这是独立桌面进程，通过 `tkinter` + Pillow 绘制，不依赖 DSH 客户端；DSH 插件里的「设置 → 宠物」页使用同一套养成规则（数值/阶段/互动一致，存档各自独立）。后续可以接托盘、开机自启、逐帧动作和换装。
