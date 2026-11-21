# 推送到 GitHub
# 用法：
#   1) 先在 GitHub 上建一个空仓库（不要勾 README / .gitignore / license）
#   2) 右键「使用 PowerShell 运行」，或在终端里：
#        .\推送GitHub.ps1 https://github.com/你的用户名/仓库名.git
#   3) 第一次会弹浏览器让你登录 GitHub（Git Credential Manager），登录一次以后就不用再登

param(
  [Parameter(Mandatory = $true)][string]$RepoUrl,
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
  Write-Host "这里还不是 git 仓库，先初始化…" -ForegroundColor Yellow
  git init | Out-Null
  git add -A
  git commit -m "先见：初始提交" | Out-Null
}

$hasOrigin = (git remote) -contains "origin"
if ($hasOrigin) {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

git branch -M $Branch
Write-Host "正在推送…（如果弹出 GitHub 登录窗口，登录即可）" -ForegroundColor Cyan
git push -u origin $Branch

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n推好了：$RepoUrl" -ForegroundColor Green
  Write-Host "接着可以去 Render / Railway 连这个仓库部署，见 大报告\服务\部署.md" -ForegroundColor Gray
} else {
  Write-Host "`n没推上去。常见原因：仓库不是空的（先删掉自动生成的 README）、或没登录 GitHub。" -ForegroundColor Red
}
