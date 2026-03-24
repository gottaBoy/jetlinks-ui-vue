#!/usr/bin/env node

const { execSync } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function runCommand(command, description) {
    console.log(`${description}...`);
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
    } catch (error) {
        console.error(`执行命令失败: ${command}`);
        console.error(error.message);
        throw error;
    }
}

async function main() {
    try {
        // 初始化子模块
        await runCommand('git submodule init', '初始化子模块');
        await runCommand('git submodule update', '更新子模块');

        // 获取主仓库当前分支
        const { stdout: mainBranch } = await execAsync('git symbolic-ref --short HEAD');
        const currentBranch = mainBranch.trim();
        console.log(`当前主分支: ${currentBranch}`);

        // 确定子模块分支
        let submoduleBranch;
        if (currentBranch === 'dev' || currentBranch === 'master') {
            submoduleBranch = 'master';
        } else {
            submoduleBranch = currentBranch;
        }
        console.log(`子模块将切换到分支: ${submoduleBranch}`);

        // 切换子模块到目标分支
        await runCommand(
            `git submodule foreach "git checkout ${submoduleBranch} || git checkout -b ${submoduleBranch} origin/${submoduleBranch}"`,
            '切换子模块分支'
        );

        // 拉取子模块最新代码
        await runCommand(
            `git submodule foreach "git pull origin ${submoduleBranch}"`,
            '拉取子模块最新代码'
        );

        console.log('完成！');
    } catch (error) {
        console.error('脚本执行失败:', error.message);
        process.exit(1);
    }
}

main();
