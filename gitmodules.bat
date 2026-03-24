@echo off
REM Windows 批处理版本的 gitmodules 脚本

echo 初始化子模块...
git submodule init
git submodule update

REM 获取主仓库当前分支
for /f %%i in ('git symbolic-ref --short HEAD') do set main_branch=%%i
echo 当前主分支: %main_branch%

REM 如果是dev或master，就使用master，否则用当前分支
if "%main_branch%"=="dev" (
    set submodule_branch=master
) else if "%main_branch%"=="master" (
    set submodule_branch=master
) else (
    set submodule_branch=%main_branch%
)

echo 子模块将切换到分支: %submodule_branch%

REM 切换子模块到目标分支
echo 切换子模块分支...
git submodule foreach "git checkout %submodule_branch% || git checkout -b %submodule_branch% origin/%submodule_branch%"

REM 拉取子模块最新代码
echo 拉取子模块最新代码...
git submodule foreach "git pull origin %submodule_branch%"

echo 完成！
pause
