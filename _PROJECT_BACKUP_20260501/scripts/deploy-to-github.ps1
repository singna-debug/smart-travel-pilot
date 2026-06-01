
# 1. Initialize Git if needed
if (-not (Test-Path .git)) {
    Write-Host "Initializing Git..."
    git init
    git branch -M main
}

# 2. Check for changes
$status = git status --porcelain
if ($status) {
    Write-Host "Changes detected. Committing..."
    git add .
    git commit -m "Deploy from Smart Travel Pilot"
} else {
    Write-Host "No changes to commit."
}

# 3. Check Remote
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host "⚠️ No GitHub repository linked."
    $repoUrl = Read-Host "Please paste your GitHub Repository URL (e.g., https://github.com/user/repo.git)"
    if ($repoUrl) {
        git remote add origin $repoUrl
        Write-Host "Remote 'origin' added."
    } else {
        Write-Error "No URL provided. Cannot push."
        exit 1
    }
} else {
    Write-Host "Linked to: $remote"
}

# 4. Push
Write-Host "🚀 Pushing to GitHub..."
git push -u origin main
if ($?) {
    Write-Host "✅ Upload Successful!"
    Write-Host "Now go to Vercel.com -> New Project -> Import from GitHub."
} else {
    Write-Host "❌ Push failed. You might need to log in to GitHub."
}
