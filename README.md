<p align="center">
  <br>
  <img alt="Logo" src="media/logo.png">
  <br><br>
  <a href="https://github.com/yifu001/son-of-anton/releases/latest"><img alt="Release" src="https://img.shields.io/github/release/yifu001/son-of-anton.svg?style=popout"></a>
  <a href="https://github.com/yifu001/son-of-anton/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/github/license/yifu001/son-of-anton.svg?style=popout"></a>
  <br><br>
</p>

**Son of Anton** is a fullscreen, cross-platform terminal emulator and system monitor that looks and feels like a sci-fi computer interface. It extends the original [eDEX-UI](https://github.com/GitSquared/edex-ui) with Claude Code integration for AI-assisted development.

> Fork of [eDEX-UI v2.2.8](https://github.com/GitSquared/edex-ui) (archived Oct. 2021)

---

## New Features (Son of Anton)

- **Claude Code Integration** - Real-time visibility into Claude Code sessions
- **Agent List Widget** - Monitor active Claude subagents
- **Todo Widget** - Track tasks from Claude Code sessions
- **Context Tracking** - Display current Claude context and token usage

## Original eDEX-UI Features

- Fully featured terminal emulator with tabs, colors, mouse events, and support for `curses` applications
- Real-time system (CPU, RAM, swap, processes) and network (GeoIP, active connections) monitoring
- Full support for touch-enabled displays, including an on-screen keyboard
- Directory viewer that follows the CWD of the terminal
- Advanced customization using themes, keyboard layouts, CSS injections
- Optional sound effects for maximum sci-fi hacking vibe

Heavily inspired by the [TRON Legacy movie effects](https://web.archive.org/web/20170511000410/http://jtnimoy.com/blogs/projects/14881671).

## Screenshots

![Default screenshot](media/screenshot_default.png)

_[neofetch](https://github.com/dylanaraps/neofetch) on eDEX-UI with the default "tron" theme_

## Installation

### From Releases
Download the latest release for your platform from the [Releases](https://github.com/yifu001/son-of-anton/releases) page.

### From Source

**Linux/macOS:**
```bash
git clone https://github.com/yifu001/son-of-anton.git
cd son-of-anton
npm run install-linux
npm run start
```

**Windows (run as Administrator):**
```powershell
git clone https://github.com/yifu001/son-of-anton.git
cd son-of-anton
npm run install-windows
npm run start
```

### Building

Note: Due to native modules, you can only build targets for the host OS.

```bash
npm install
npm run build-linux   # or build-windows or build-darwin
```

## Q&A

#### I have a problem!
Search through the [Issues](https://github.com/yifu001/son-of-anton/issues) to see if yours has been reported. If not, feel free to open a new one.

#### Can you disable the keyboard/filesystem display?
You can hide them using the `tron-notype` theme.

#### Why is the file browser saying "Tracking Failed"? (Windows)
On Windows, terminal CWD tracking is not supported. The file browser uses "detached" mode instead.

#### Can this run on a Raspberry Pi / ARM device?
ARM64 builds are provided. For other platforms, build from source.

## Credits

### Son of Anton
- Fork maintained by [yifu001](https://github.com/yifu001)

### Original eDEX-UI
- Created by [Squared](https://github.com/GitSquared) - [website](https://gaby.dev)
- [PixelyIon](https://github.com/PixelyIon) - Windows compatibility
- [IceWolf](https://soundcloud.com/iamicewolf) - Sound effects (v2.1.x+)

### Dependencies
- [xterm.js](https://github.com/xtermjs/xterm.js)
- [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- [SmoothieCharts](https://github.com/joewalnes/smoothie)
- [ENCOM Globe](https://github.com/arscan/encom-globe) by Rob Scanlon

## License

Licensed under the [GPLv3.0](https://github.com/yifu001/son-of-anton/blob/master/LICENSE).
