@echo off
rem ============================================================
rem  工作台本地启动器 (Workbench Launcher)
rem  直接双击 index.html 用 file:// 打开会被浏览器禁用
rem  Web Worker 与 IndexedDB，导致「转换工具-压缩/转图/转TXT」
rem  和「动态卡面」无法使用。本启动器用 http://localhost 打开，
rem  所有功能都正常。用完关闭弹出的黑窗口即可停止服务。
rem ============================================================
start "" "C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m http.server 8765 --directory "D:\workbuddy\workbench-project\workbench"
timeout /t 2 >nul
start "" "http://localhost:8765/index.html"
exit
