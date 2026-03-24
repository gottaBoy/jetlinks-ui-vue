# PowerShell version of gitmodules script

Write-Host "Initializing submodules..." -ForegroundColor Green
git submodule init
git submodule update

# Get current branch of main repository
$main_branch = git symbolic-ref --short HEAD
Write-Host "Current main branch: $main_branch" -ForegroundColor Yellow

# If dev or master, use master, otherwise use current branch
if ($main_branch -eq "dev" -or $main_branch -eq "master") {
    $submodule_branch = "master"
} else {
    $submodule_branch = $main_branch
}

Write-Host "Submodules will switch to branch: $submodule_branch" -ForegroundColor Yellow

# Switch submodules to target branch
Write-Host "Switching submodule branches..." -ForegroundColor Green
git submodule foreach "git checkout $submodule_branch || git checkout -b $submodule_branch origin/$submodule_branch"

# Pull latest code for submodules
Write-Host "Pulling latest submodule code..." -ForegroundColor Green
git submodule foreach "git pull origin $submodule_branch"

Write-Host "Completed!" -ForegroundColor Green
