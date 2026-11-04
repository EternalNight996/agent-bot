#!/usr/bin/env python3
r"""小肥鱼桌面宠物（Windows / tkinter）。

一个真正浮在桌面上的透明宠物窗口：蓝色大肥鱼会呼吸、摆尾、眨眼，
可以拖动换位置，左键摸摸、双击陪玩、右键喂食/玩耍/休息/退出。

养成数据保存在 %APPDATA%\dsh-pet\state.json；默认读取当前工作区的
.agent-teams/**/team.json，团队每完成一个任务，宠物获得一次成长经验。
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageTk

try:
    import tkinter as tk
    from tkinter import font as tkfont, messagebox
except Exception as exc:  # pragma: no cover - 桌面环境缺失时给出可读错误
    tk = None  # type: ignore[assignment]
    print("tkinter is required: " + str(exc), file=sys.stderr)

APP_DIR = Path(__file__).resolve().parent
ASSET_DIR = APP_DIR / "assets"
STATE_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "dsh-pet"
STATE_FILE = STATE_DIR / "state.json"

WINDOW_W, WINDOW_H = 180, 240
TRANSPARENT = "#010203"
MAX_OFFLINE_SECONDS = 12 * 3600
FRAME_COUNT = 16
FRAME_MS = 100

STAGE_NAMES = {
    "fry": "幼鲸",
    "small": "小鲸娘",
    "fat": "鲸鱼娘",
    "whale": "大鲸娘",
}
STAGE_SCALE = {"fry": 0.86, "small": 0.92, "fat": 1.0, "whale": 1.0}

CLICK_ANIMS = ("click-wave", "click-happy", "click-shy", "click-pout", "click-tickle")
WORK_ANIMS = ("work-pace", "work-sigh", "work-busy", "work-think", "work-sort", "work-cheer")
IDLE_VARIANTS = ("idle-look", "idle-stretch", "idle-yawn", "idle-breathe")
EXTRA_ANIMS = CLICK_ANIMS + WORK_ANIMS + IDLE_VARIANTS + ("sleep-start", "sleep-loop", "sleep-end", "drag")


def _font(size: int) -> ImageFont.FreeTypeFont:
    for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "arial.ttf"):
        path = Path(r"C:\Windows\Fonts") / name
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except Exception:
                continue
    return ImageFont.load_default()


def clamp(value: float, low: float = 0, high: float = 100) -> int:
    return int(max(low, min(high, round(value))))


def xp_for_next(level: int) -> int:
    return 30 + max(0, level - 1) * 20


def level_of(xp: int) -> tuple[int, int, int]:
    """返回 (等级, 当前级已得经验, 升级所需经验)。"""
    level = 1
    remaining = max(0, int(xp))
    while level < 50:
        need = xp_for_next(level)
        if remaining < need:
            return level, remaining, need
        remaining -= need
        level += 1
    return 50, 0, xp_for_next(50)


def stage_of(level: int) -> str:
    if level >= 8:
        return "whale"
    if level >= 5:
        return "fat"
    if level >= 3:
        return "small"
    return "fry"


def new_state(now: float | None = None) -> dict:
    now = time.time() if now is None else now
    return {
        "name": "小肥鱼",
        "xp": 24,
        "satiety": 72,
        "mood": 82,
        "energy": 90,
        "last_tick": now,
        "last_task_count": 0,
        "last_fed": 0.0,
        "last_played": 0.0,
        "last_petted": 0.0,
        "last_rested": 0.0,
        "sleeping": False,
        "sleep_until": 0.0,
        "x": None,
        "y": None,
    }


def normalize_state(raw: object, now: float | None = None) -> dict:
    now = time.time() if now is None else now
    base = new_state(now)
    if not isinstance(raw, dict):
        return base
    num = lambda key, fallback: float(raw[key]) if isinstance(raw.get(key), (int, float)) else fallback
    base.update({
        "name": str(raw.get("name") or base["name"])[:16],
        "xp": max(0, int(num("xp", base["xp"]))),
        "satiety": clamp(num("satiety", base["satiety"])),
        "mood": clamp(num("mood", base["mood"])),
        "energy": clamp(num("energy", base["energy"])),
        "last_tick": num("last_tick", base["last_tick"]),
        "last_task_count": max(0, int(num("last_task_count", 0))),
        "last_fed": num("last_fed", 0),
        "last_played": num("last_played", 0),
        "last_petted": num("last_petted", 0),
        "last_rested": num("last_rested", 0),
        "sleeping": raw.get("sleeping") is True and num("sleep_until", 0) > now,
        "sleep_until": num("sleep_until", 0),
        "x": int(raw["x"]) if isinstance(raw.get("x"), (int, float)) else None,
        "y": int(raw["y"]) if isinstance(raw.get("y"), (int, float)) else None,
    })
    return base


def tick_state(state: dict, now: float | None = None) -> dict:
    now = time.time() if now is None else now
    elapsed = max(0.0, min(MAX_OFFLINE_SECONDS, now - float(state["last_tick"])))
    minutes = int(elapsed // 60)
    if minutes <= 0:
        return state
    if state.get("sleeping") and float(state.get("sleep_until", 0)) > 0:
        woke = now >= float(state["sleep_until"])
        state.update({
            "satiety": clamp(state["satiety"] - minutes // 20),
            "mood": clamp(state["mood"] + 3) if woke else state["mood"],
            "energy": clamp(state["energy"] + minutes // 2 + (5 if woke else 0)),
            "sleeping": not woke,
            "sleep_until": 0.0 if woke else state["sleep_until"],
            "last_tick": state["last_tick"] + minutes * 60,
        })
        return state
    satiety = clamp(state["satiety"] - minutes // 8)
    mood_drop = minutes // 8 if satiety <= 0 else minutes // 15
    state.update({
        "satiety": satiety,
        "mood": clamp(state["mood"] - mood_drop),
        "energy": clamp(state["energy"] + minutes // 10),
        "last_tick": state["last_tick"] + minutes * 60,
    })
    return state


def _cooldown(state: dict, field: str, now: float, seconds: float) -> bool:
    return now - float(state.get(field, 0)) >= seconds


def feed(state: dict, now: float) -> tuple[bool, str]:
    if state.get("sleeping"):
        return False, "sleeping"
    if state["satiety"] >= 100:
        return False, "full"
    if not _cooldown(state, "last_fed", now, 15):
        return False, "cooldown"
    state.update({
        "satiety": clamp(state["satiety"] + 26),
        "mood": clamp(state["mood"] + 5),
        "energy": clamp(state["energy"] - 2),
        "xp": state["xp"] + 6,
        "last_fed": now,
    })
    return True, "feed"


def play(state: dict, now: float) -> tuple[bool, str]:
    if state.get("sleeping"):
        return False, "sleeping"
    if state["energy"] < 10:
        return False, "tired"
    if not _cooldown(state, "last_played", now, 20):
        return False, "cooldown"
    state.update({
        "mood": clamp(state["mood"] + 18),
        "energy": clamp(state["energy"] - 12),
        "satiety": clamp(state["satiety"] - 4),
        "xp": state["xp"] + 8,
        "last_played": now,
    })
    return True, "play"


def pat(state: dict, now: float) -> tuple[bool, str]:
    if state.get("sleeping"):
        state.update({"sleeping": False, "sleep_until": 0.0, "mood": clamp(state["mood"] + 7), "xp": state["xp"] + 2})
        return True, "woke"
    if not _cooldown(state, "last_petted", now, 8):
        return False, "cooldown"
    state.update({
        "mood": clamp(state["mood"] + 7),
        "xp": state["xp"] + 2,
        "last_petted": now,
    })
    return True, "pat"


def rest(state: dict, now: float) -> tuple[bool, str]:
    if state.get("sleeping"):
        return False, "sleeping"
    if state["energy"] >= 100:
        return False, "full"
    if not _cooldown(state, "last_rested", now, 30):
        return False, "cooldown"
    state.update({
        "sleeping": True,
        "sleep_until": now + 600,
        "mood": clamp(state["mood"] + 2),
        "xp": state["xp"] + 3,
        "last_rested": now,
    })
    return True, "rest"


def count_completed_tasks(workspace: Path) -> int:
    """统计工作区 .agent-teams 下所有 team.json 的已完成任务数。"""
    root = workspace / ".agent-teams"
    if not root.exists():
        return 0
    total = 0
    for path in root.rglob("team.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        tasks = data.get("tasks") if isinstance(data, dict) else None
        if not isinstance(tasks, list):
            continue
        total += sum(1 for task in tasks if isinstance(task, dict) and task.get("status") == "completed")
    return total


def load_state(workspace: Path | None) -> dict:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not STATE_FILE.exists():
        state = new_state()
        if workspace is not None:
            # 第一次启动不补发历史任务经验，只记录基线。
            state["last_task_count"] = count_completed_tasks(workspace)
        save_state(state)
        return tick_state(state)
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = None
    return tick_state(normalize_state(raw))


def save_state(state: dict) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


# ---------------------------------------------------------------- 美术生成

def _gradient(width: int, height: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)) + (255,)
        draw.line([(0, y), (width, y)], fill=color)
    return image


def render_fish_frames(size: int = 256) -> list[Image.Image]:
    """生成 8 帧：摆尾、呼吸、眨眼。"""
    frames: list[Image.Image] = []
    for index in range(FRAME_COUNT):
        phase = index / FRAME_COUNT * math.tau
        bob = int(round(math.sin(phase) * 2))
        tail = int(round(math.sin(phase) * 12))
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        # 阴影
        draw.ellipse((64, 214, 204, 238), fill=(0, 20, 43, 90))

        # 尾巴（左右两瓣）
        tail_root = (66, 150 + bob // 2)
        draw.polygon([tail_root, (14, 112 + tail), (26, 150 + bob), (14, 190 - tail)], fill=(38, 96, 200, 255))
        draw.polygon([tail_root, (26, 132 + bob), (12, 150 + tail // 2), (26, 168 + bob)], fill=(77, 160, 255, 255))

        # 身体渐变 + 椭圆遮罩
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((58, 88 + bob, 210, 206 + bob), fill=255)
        body = _gradient(size, size, (159, 224, 255), (43, 99, 217))
        body.putalpha(mask)
        image.alpha_composite(body)

        # 身体描边
        draw.ellipse((58, 88 + bob, 210, 206 + bob), outline=(23, 65, 145, 230), width=3)

        # 背鳍 / 侧鳍
        draw.polygon([(112, 94 + bob), (144, 54 + bob), (164, 94 + bob)], fill=(94, 194, 255, 255))
        draw.polygon([(122, 168 + bob), (92, 196 + bob), (142, 190 + bob)], fill=(72, 160, 255, 255))

        # 肚皮
        draw.ellipse((92, 146 + bob, 190, 202 + bob), fill=(220, 246, 255, 245))

        # 眼睛 / 眨眼
        eye_y = 132 + bob
        if index == 6:
            draw.arc((166, eye_y - 5, 184, eye_y + 8), 10, 170, fill=(12, 40, 78, 255), width=4)
        else:
            draw.ellipse((166, eye_y - 10, 184, eye_y + 10), fill=(12, 40, 78, 255))
            draw.ellipse((170, eye_y - 6, 176, eye_y), fill=(255, 255, 255, 255))

        # 腮红 / 嘴 / 高光
        draw.ellipse((136, 154 + bob, 154, 166 + bob), fill=(255, 150, 185, 120))
        draw.arc((186, 142 + bob, 204, 160 + bob), 20, 150, fill=(12, 40, 78, 255), width=3)
        draw.arc((92, 112 + bob, 140, 148 + bob), 200, 290, fill=(238, 250, 255, 210), width=5)

        frames.append(image)
    return frames


def load_animation(name: str, limit: int = 120) -> list[Image.Image]:
    """加载从上游 webm 抽出的逐帧动画（已去黑底、裁切、缩放到 240 高）。"""
    folder = ASSET_DIR / ("anim-" + name)
    if not folder.exists():
        print("[pet] animation folder missing: %s" % name, file=sys.stderr)
        return []
    frames: list[Image.Image] = []
    for path in sorted(folder.glob("*.png"))[:limit]:
        try:
            frames.append(Image.open(path).convert("RGBA"))
        except Exception as exc:
            print("[pet] failed to load animation frame %s: %s" % (path, exc), file=sys.stderr)
            continue
    if not frames:
        print("[pet] no frames loaded for animation '%s'" % name, file=sys.stderr)
    return frames


def render_frames(size: int = 260) -> list[Image.Image]:
    """从参考立绘生成 16 帧：呼吸、摆身、上下浮动和投影。"""
    sprite_path = ASSET_DIR / "whale-girl.png"
    if not sprite_path.exists():
        return render_fish_frames(size)
    base = Image.open(sprite_path).convert("RGBA")
    base.thumbnail((210, 250), Image.Resampling.LANCZOS)
    frames: list[Image.Image] = []
    for index in range(FRAME_COUNT):
        phase = index / FRAME_COUNT * math.tau
        breathe = 1.0 + 0.012 * math.sin(phase * 2)
        sprite = base.resize((max(1, int(base.width / breathe)), max(1, int(base.height * breathe))), Image.Resampling.LANCZOS)
        tilt = math.sin(phase) * 1.6
        rotated = sprite.rotate(tilt, resample=Image.Resampling.BICUBIC, expand=True)
        bob = int(round(math.sin(phase) * 4))
        sway = int(round(math.cos(phase) * 2))
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse((size // 2 - 58, size - 26, size // 2 + 58, size - 8), fill=(0, 10, 26, 95))
        x = size // 2 - rotated.width // 2 + sway
        y = size - 18 - rotated.height + bob
        image.alpha_composite(rotated, (x, y))
        frames.append(image)
    return frames


def bubble_image(text: str, mood: str) -> Image.Image:
    font = _font(15)
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bbox = probe.textbbox((0, 0), text, font=font)
    width = max(100, bbox[2] - bbox[0] + 30)
    height = 44
    image = Image.new("RGBA", (width, height + 12), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    fill = (10, 26, 48, 242) if mood != "hungry" else (46, 22, 30, 242)
    outline = (110, 196, 255, 235) if mood != "hungry" else (255, 150, 170, 235)
    draw.rounded_rectangle((0, 0, width - 1, height), radius=14, fill=fill, outline=outline, width=2)
    draw.polygon([(width // 2 - 7, height), (width // 2 + 7, height), (width // 2, height + 11)], fill=fill)
    draw.text((15, 11), text, font=font, fill=(226, 243, 255, 255))
    return image


def stats_image(state: dict) -> Image.Image:
    width, height = 286, 82
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=16, fill=(9, 22, 40, 238), outline=(60, 130, 220, 220), width=2)
    font = _font(12)
    small = _font(11)
    level, into, need = level_of(int(state["xp"]))
    stage = stage_of(level)
    draw.text((12, 8), "Lv.%d %s" % (level, STAGE_NAMES[stage]), font=font, fill=(190, 228, 255, 255))
    draw.text((width - 92, 9), "成长 %d/%d" % (into, need), font=small, fill=(140, 178, 214, 255))

    rows = [
        ("饱食", state["satiety"], (255, 186, 92)),
        ("心情", state["mood"], (255, 128, 176)),
        ("精力", state["energy"], (112, 210, 255)),
    ]
    for index, (label, value, color) in enumerate(rows):
        y = 31 + index * 16
        draw.text((12, y - 1), label, font=small, fill=(158, 184, 210, 255))
        draw.rounded_rectangle((48, y + 2, 232, y + 9), radius=4, fill=(24, 40, 62, 255))
        draw.rounded_rectangle((48, y + 2, 48 + int(184 * value / 100), y + 9), radius=4, fill=color + (235,))
        draw.text((242, y - 1), str(value), font=small, fill=(210, 230, 248, 255))
    return image


class PetApp:
    """桌面宠物窗口：只有角色本体，互动全走右键菜单/双击/拖动。"""

    def __init__(self, root: tk.Tk, workspace: Path | None, sync: bool) -> None:
        self.root = root
        self.workspace = workspace
        self.sync = sync
        self.state = load_state(workspace)
        self.frames = render_frames()
        self.frame_index = 0
        self.animations: dict[str, list[Image.Image]] = {}
        for name in ("idle", "feed", "play", "sleep", "work", "pet", "run") + EXTRA_ANIMS:
            loaded = load_animation(name)
            if loaded:
                self.animations[name] = loaded
        if "idle" not in self.animations:
            print("[pet] dsh-pet idle frames unavailable; falling back to generated frames", file=sys.stderr)
            self.animations["idle"] = self.frames
        self.anim_name = "idle"
        self.anim_index = 0
        self.anim_until = 0.0
        self.anim_next: str | None = None
        self.sleeping = bool(self.state.get("sleeping"))
        self.last_click: str | None = None
        self.last_work: str | None = None
        self.last_idle_variant: str | None = None
        self.next_idle_at = time.time() + random.uniform(15, 30)
        if self.sleeping and "sleep-loop" in self.animations:
            self.anim_name = "sleep-loop"
        self.roaming = False
        self.roam_target_x: int | None = None
        self.next_roam_at = time.time() + random.uniform(8, 14)
        self.pet_photo: ImageTk.PhotoImage | None = None
        self.drag_origin: tuple[int, int, int, int] | None = None
        self.dragged = False
        self.menu = tk.Menu(root, tearoff=0)
        for label, command in (("喂食 🍚", lambda: self.action("feed")), ("陪玩 🎾", lambda: self.action("play")),
                               ("摸摸 🤚", lambda: self.action("pat")), ("休息 😴", lambda: self.action("rest"))):
            self.menu.add_command(label=label, command=command)
        self.menu.add_separator()
        self.build_preview_menu()
        self.menu.add_separator()
        self.menu.add_command(label="查看状态", command=self.show_status)
        self.menu.add_command(label="退出", command=self.quit)
        self.setup_window()
        self.build_canvas()
        for key, kind in (("f", "feed"), ("p", "play"), ("m", "pat"), ("r", "rest")):
            self.root.bind("<KeyPress-%s>" % key, lambda _event, k=kind: self.action(k))
            self.root.bind("<KeyPress-%s>" % key.upper(), lambda _event, k=kind: self.action(k))
        self.root.bind("<KeyPress-s>", lambda _event: self.show_status())
        self.root.bind("<KeyPress-S>", lambda _event: self.show_status())
        self.root.after(60, self.frame_loop)
        self.root.after(200, self.roam_loop)
        self.root.after(200, self.tick_loop)
        self.root.after(1000, self.sync_loop)
        # Tk 在部分高 DPI/旋转屏上的屏幕尺寸不可靠；先用一个稳定的可见位置，
        # 用户可以拖动到任意角落。

    # ------------------------------------------------------------ 窗口
    def setup_window(self) -> None:
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg=TRANSPARENT)
        try:
            self.root.wm_attributes("-transparentcolor", TRANSPARENT)
        except Exception:
            pass
        # Tk 在多 DPI/旋转屏上拿不到可靠屏幕尺寸，先固定在一个可见位置。
        x = 600
        y = 200
        self.state["x"] = x
        self.state["y"] = y
        self.root.geometry("%dx%d+%d+%d" % (WINDOW_W, WINDOW_H, x, y))

    def build_canvas(self) -> None:
        self.canvas = tk.Canvas(self.root, width=WINDOW_W, height=WINDOW_H, bg=TRANSPARENT,
                                highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True)
        self.pet_item = self.canvas.create_image(WINDOW_W // 2, WINDOW_H - 8, anchor="s")
        self.canvas.tag_bind(self.pet_item, "<ButtonPress-1>", self.on_press)
        self.canvas.tag_bind(self.pet_item, "<B1-Motion>", self.on_drag)
        self.canvas.tag_bind(self.pet_item, "<ButtonRelease-1>", self.on_release)
        self.canvas.tag_bind(self.pet_item, "<Double-Button-1>", lambda _e: self.action("play"))
        self.canvas.tag_bind(self.pet_item, "<Button-3>", self.on_menu)
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.canvas.bind("<Double-Button-1>", lambda _e: self.action("play"))
        self.canvas.bind("<Button-3>", self.on_menu)

    def place_bottom_right(self) -> None:
        script = r'''
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PetWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
"@
[PetWin]::SetProcessDPIAware() | Out-Null
$h = (Get-Process -Id __PID__).MainWindowHandle
if ($h -ne 0) {
  $r = New-Object PetWin+RECT
  [PetWin]::GetWindowRect($h, [ref]$r) | Out-Null
  $w = $r.Right - $r.Left
  $ht = $r.Bottom - $r.Top
  Add-Type -AssemblyName System.Windows.Forms
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  [PetWin]::SetWindowPos($h, [IntPtr]::Zero, $bounds.Width - $w - 24, $bounds.Height - $ht - 70, 0, 0, 5) | Out-Null
}
'''.replace("__PID__", str(os.getpid()))
        try:
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                           creationflags=0x08000000, timeout=8)
        except Exception:
            pass

    # ------------------------------------------------------------ 渲染
    def frame_loop(self) -> None:
        now = time.time()
        if self.anim_until and now >= self.anim_until:
            nxt = self.anim_next
            self.anim_next = None
            self.anim_index = 0
            if nxt:
                self.play_animation(nxt, once=False)
            else:
                self.anim_name = "sleep-loop" if self.sleeping else "idle"
                self.anim_until = 0.0
        if not self.anim_until and self.anim_name in ("idle", "sleep"):
            desired = "sleep" if (self.state["satiety"] < 25 or self.state["energy"] < 20) else "idle"
            if desired != self.anim_name:
                self.anim_name = desired
                self.anim_index = 0
        if (not self.anim_until and not self.sleeping and self.anim_name == "idle"
                and now >= self.next_idle_at):
            self.play_animation(self.pick_idle_variant(), once=True)
            delay = random.uniform(14, 30) if self.state["energy"] >= 40 else random.uniform(8, 18)
            if self.state["mood"] < 30:
                delay *= 0.8
            self.next_idle_at = now + delay
        frames = self.animations.get(self.anim_name) or self.animations["idle"]
        level = level_of(int(self.state["xp"]))[0]
        stage = stage_of(level)
        scale = STAGE_SCALE[stage]
        frame = frames[self.anim_index % len(frames)]
        fit = min((WINDOW_W - 8) / frame.width, (WINDOW_H - 12) / frame.height)
        resized = max(0.2, fit * scale)
        image = frame.resize((max(1, int(frame.width * resized)), max(1, int(frame.height * resized))), Image.Resampling.LANCZOS)
        self.pet_photo = ImageTk.PhotoImage(image)
        self.canvas.itemconfigure(self.pet_item, image=self.pet_photo)
        self.anim_index += 1
        self.root.after(FRAME_MS, self.frame_loop)

    def play_animation(self, name: str, once: bool = True, then: str | None = None) -> None:
        frames = self.animations.get(name)
        if not frames:
            return
        self.anim_name = name
        self.anim_index = random.randrange(len(frames)) if name == "idle" and not once else 0
        self.anim_next = then
        self.anim_until = time.time() + len(frames) * FRAME_MS / 1000 if once else 0.0

    def pick_idle_variant(self) -> str:
        weights = {
            "idle-look": 3,
            "idle-breathe": 2,
            "idle-stretch": 2 if self.state["energy"] >= 40 else 1,
            "idle-yawn": 3 if self.state["energy"] < 45 else 1,
        }
        pool = [(name, weight) for name, weight in weights.items() if name != self.last_idle_variant]
        choice = random.choices([name for name, _ in pool], weights=[weight for _, weight in pool])[0]
        self.last_idle_variant = choice
        return choice

    def roam_loop(self) -> None:
        now = time.time()
        if (not self.roaming and not self.sleeping and self.drag_origin is None
                and not self.anim_until and self.anim_name == "idle"
                and now >= self.next_roam_at):
            self.start_roam()
        if self.roaming:
            self.step_roam()
        self.root.after(50, self.roam_loop)

    def start_roam(self) -> None:
        x = self.root.winfo_x()
        screen_w = self.root.winfo_screenwidth()
        distance = random.randint(80, 220) * random.choice((-1, 1))
        target = max(0, min(x + distance, screen_w - WINDOW_W))
        if target == x:
            target = max(0, min(x - distance, screen_w - WINDOW_W))
        self.roam_target_x = target
        self.roaming = True
        self.play_animation("run", once=False)

    def step_roam(self) -> None:
        if self.roam_target_x is None:
            self.roaming = False
            return
        x = self.root.winfo_x()
        target = self.roam_target_x
        if abs(target - x) <= 3:
            self.root.geometry("+%d+%d" % (target, self.root.winfo_y()))
            self.state["x"] = target
            self.state["y"] = self.root.winfo_y()
            save_state(self.state)
            self.roaming = False
            self.roam_target_x = None
            self.play_animation("idle", once=False)
            self.next_roam_at = time.time() + random.uniform(18, 28)
            return
        step = 4 if target > x else -4
        self.root.geometry("+%d+%d" % (x + step, self.root.winfo_y()))

    def stop_roam(self) -> None:
        if self.roaming:
            self.roaming = False
            self.roam_target_x = None
            self.play_animation("idle", once=False)

    def pick_click(self) -> str:
        pool = [name for name in CLICK_ANIMS if name != self.last_click]
        choice = random.choice(pool)
        self.last_click = choice
        return choice

    def pick_work(self) -> str:
        pool = [name for name in WORK_ANIMS if name != self.last_work]
        choice = random.choice(pool)
        self.last_work = choice
        return choice

    def build_preview_menu(self) -> None:
        preview = tk.Menu(self.menu, tearoff=0)
        groups = (
            ("点击回应", (
                ("元气挥手", "click-wave"), ("开心跃动", "click-happy"),
                ("害羞惊讶", "click-shy"), ("傲娇生气", "click-pout"),
                ("挠痒咯咯笑", "click-tickle"),
            )),
            ("睡觉", (("开始", "sleep-start"), ("循环", "sleep-loop"), ("起来", "sleep-end"))),
            ("工作状态", (
                ("踱步张望", "work-pace"), ("垂头叹气", "work-sigh"),
                ("忙碌点按", "work-busy"), ("思考冒泡", "work-think"),
                ("清点归档", "work-sort"), ("雀跃庆祝", "work-cheer"),
            )),
            ("拖拽反馈", (("悬空反馈", "drag"),)),
            ("随机待机", (
                ("东张西望", "idle-look"), ("超大伸懒腰", "idle-stretch"),
                ("哈欠连天", "idle-yawn"), ("待机呼吸", "idle-breathe"),
            )),
        )
        for title, items in groups:
            sub = tk.Menu(preview, tearoff=0)
            for label, key in items:
                sub.add_command(label=label, command=lambda k=key: self.preview_animation(k))
            preview.add_cascade(label=title, menu=sub)
        preview.add_separator()
        preview.add_command(label="回到待机", command=self.preview_idle)
        self.menu.add_cascade(label="动作预览", menu=preview)

    def preview_animation(self, name: str) -> None:
        self.stop_roam()
        if name == "sleep-start":
            self.sleeping = True
            self.play_animation(name, then="sleep-loop")
        elif name == "sleep-loop":
            self.sleeping = True
            self.play_animation(name, once=False)
        elif name == "sleep-end":
            self.sleeping = False
            self.play_animation(name, then="idle")
        else:
            self.sleeping = False
            self.play_animation(name, once=True)

    def preview_idle(self) -> None:
        self.sleeping = False
        self.play_animation("idle", once=False)

    def spark(self, glyph: str, color: str = "#ffd1e6") -> None:
        item = self.canvas.create_text(WINDOW_W // 2, 120, text=glyph, fill=color,
                                       font=("Segoe UI Emoji", 18))
        steps = 7

        def step(index: int) -> None:
            if index >= steps:
                self.canvas.delete(item)
                return
            self.canvas.move(item, 0, -4)
            self.root.after(90, lambda: step(index + 1))

        step(0)

    # ------------------------------------------------------------ 交互
    def on_press(self, event) -> None:
        self.stop_roam()
        self.root.focus_force()
        self.drag_origin = (event.x_root, event.y_root, self.root.winfo_x(), self.root.winfo_y())
        self.dragged = False

    def on_drag(self, event) -> None:
        if self.drag_origin is None:
            return
        sx, sy, wx, wy = self.drag_origin
        dx, dy = event.x_root - sx, event.y_root - sy
        if abs(dx) > 4 or abs(dy) > 4:
            self.dragged = True
        self.root.geometry("+%d+%d" % (wx + dx, wy + dy))
        if self.dragged and self.anim_name != "drag":
            self.play_animation("drag", once=False)

    def on_release(self, event) -> None:
        if self.drag_origin is None:
            return
        if self.dragged:
            screen_w = self.root.winfo_screenwidth()
            screen_h = self.root.winfo_screenheight()
            x = max(0, min(self.root.winfo_x(), screen_w - WINDOW_W))
            y = max(0, min(self.root.winfo_y(), screen_h - WINDOW_H))
            self.root.geometry("+%d+%d" % (x, y))
            self.state["x"] = x
            self.state["y"] = y
            save_state(self.state)
            self.play_animation("sleep-loop" if self.sleeping else "idle", once=False)
        else:
            self.action("pat")
        self.drag_origin = None

    def on_menu(self, event) -> None:
        try:
            self.menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.menu.grab_release()

    def action(self, kind: str) -> None:
        self.stop_roam()
        if kind == "pat" and self.sleeping:
            self.sleeping = False
            self.state["sleeping"] = False
            self.state["sleep_until"] = 0.0
            self.play_animation("sleep-end", then="idle")
            self.next_idle_at = time.time() + random.uniform(2, 6)
            save_state(self.state)
            return
        if kind != "rest" and self.sleeping:
            self.sleeping = False
            self.state["sleeping"] = False
            self.state["sleep_until"] = 0.0
        now = time.time()
        before = level_of(int(self.state["xp"]))[0]
        handlers = {"feed": feed, "play": play, "pat": pat, "rest": rest}
        ok, _reason = handlers[kind](self.state, now)
        after = level_of(int(self.state["xp"]))[0]
        if ok:
            self.spark({"feed": "🍚", "play": "✨", "pat": "❤", "rest": "💤"}[kind])
            if kind == "rest":
                self.sleeping = True
                self.play_animation("sleep-start", then="sleep-loop")
            elif kind == "pat":
                self.play_animation(self.pick_click())
            else:
                self.play_animation({"feed": "feed", "play": "play"}[kind])
        if after > before:
            self.spark("⭐", "#ffe28a")
            self.play_animation("play")
        save_state(self.state)

    def show_status(self) -> None:
        level, into, need = level_of(int(self.state["xp"]))
        stage = stage_of(level)
        messagebox.showinfo("小肥鱼", "%s Lv.%d\n成长 %d/%d\n饱食 %d  心情 %d  精力 %d" % (
            STAGE_NAMES[stage], level, into, need, self.state["satiety"], self.state["mood"], self.state["energy"]))

    def tick_loop(self) -> None:
        tick_state(self.state)
        if self.sleeping and not self.state.get("sleeping"):
            self.sleeping = False
            self.play_animation("sleep-end", then="idle")
        save_state(self.state)
        self.root.after(30_000, self.tick_loop)

    def sync_loop(self) -> None:
        if self.sync and self.workspace is not None:
            total = count_completed_tasks(self.workspace)
            delta = total - int(self.state["last_task_count"])
            if delta > 0:
                self.state["xp"] += delta * 12
                self.state["mood"] = clamp(self.state["mood"] + delta * 4)
                self.state["last_task_count"] = total
                save_state(self.state)
                self.spark("✨", "#9fe0ff")
                self.play_animation(self.pick_work())
            elif delta < 0:
                self.state["last_task_count"] = total
                save_state(self.state)
        self.root.after(10_000, self.sync_loop)

    def quit(self) -> None:
        save_state(self.state)
        self.root.destroy()


def run_check(workspace: Path | None) -> int:
    """不打开窗口的自检：验证数值模型、帧图与状态读写。"""
    now = 1_800_000_000.0
    state = new_state(now)
    assert level_of(0) == (1, 0, 30), level_of(0)
    assert level_of(30) == (2, 0, 50), level_of(30)
    assert stage_of(1) == "fry" and stage_of(3) == "small" and stage_of(5) == "fat" and stage_of(8) == "whale"
    before = int(state["satiety"])
    tick_state(state, now + 3600)
    assert int(state["satiety"]) < before, (before, state["satiety"])
    ok, _ = feed(state, now + 7200)
    assert ok, "feed should succeed"
    sleepy = new_state(now)
    sleepy["energy"] = 40
    ok, _ = rest(sleepy, now + 31)
    assert ok and sleepy["sleeping"], "rest should start a sleep"
    assert sleepy["sleep_until"] == now + 31 + 600
    mid = tick_state(sleepy, now + 31 + 300)
    assert mid["sleeping"] and mid["energy"] > 40, "sleep should recover energy"
    woke_ok, woke_reason = pat(mid, now + 31 + 301)
    assert woke_ok and woke_reason == "woke" and not mid["sleeping"], "pat should wake"
    auto_state = new_state(now)
    auto_state["energy"] = 40
    rest(auto_state, now + 31)
    auto = tick_state(auto_state, now + 31 + 600)
    assert not auto["sleeping"], "sleep should end after 10 minutes"
    frames = render_frames()
    assert len(frames) == FRAME_COUNT and frames[0].size == (260, 260)
    idle = load_animation("idle")
    assert len(idle) >= 10 and idle[0].height >= 180, (len(idle), idle[0].size if idle else None)
    for name in EXTRA_ANIMS + ("run",):
        loaded = load_animation(name)
        assert len(loaded) >= 8, (name, len(loaded))
    total = count_completed_tasks(workspace) if workspace is not None else 0
    print(json.dumps({
        "ok": True,
        "level": level_of(int(state["xp"]))[0],
        "stage": stage_of(level_of(int(state["xp"]))[0]),
        "frames": len(frames),
        "completedTasks": total,
        "state": str(STATE_FILE),
    }, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="小肥鱼桌面宠物")
    parser.add_argument("--workspace", default=str(Path.cwd()), help="读取 .agent-teams 任务进度的工作区")
    parser.add_argument("--no-sync", action="store_true", help="不读取 DSH 任务经验")
    parser.add_argument("--check", action="store_true", help="只做自检，不打开窗口")
    parser.add_argument("--reset", action="store_true", help="删除存档并从新鱼开始")
    args = parser.parse_args()
    workspace = Path(args.workspace).expanduser().resolve()
    if args.reset:
        try:
            STATE_FILE.unlink()
        except FileNotFoundError:
            pass
        print("state reset: " + str(STATE_FILE))
        return 0
    if args.check:
        return run_check(workspace)
    if tk is None:
        return 2
    root = tk.Tk()
    root.title("小肥鱼")
    PetApp(root, workspace, not args.no_sync)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
