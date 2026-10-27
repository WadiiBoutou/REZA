#!/usr/bin/env pwsh
# REZA Mobile Demo APK Builder
# This script builds both Pro and Client mobile APKs with demo mode

Write-Host "================================" -ForegroundColor Cyan
Write-Host "REZA Mobile Demo APK Builder" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to clean Gradle cache safely
function Clean-GradleCache {
    Write-Host "Stopping any Gradle daemons..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -like "*gradle*" -or $_.ProcessName -like "*java*"} | 
        ForEach-Object { 
            Write-Host "  Stopping process: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue 
        }
    
    Start-Sleep -Seconds 2
    
    Write-Host "Cleaning Gradle cache..." -ForegroundColor Yellow
    $gradleCache = "$env:USERPROFILE\.gradle\caches"
    if (Test-Path $gradleCache) {
        try {
            Remove-Item -Path $gradleCache -Recurse -Force -ErrorAction Stop
            Write-Host "  ✓ Gradle cache cleaned" -ForegroundColor Green
        } catch {
            Write-Host "  ! Gradle cache in use, will rebuild anyway" -ForegroundColor Yellow
        }
    }
}

# Function to build an APK
function Build-APK {
    param(
        [string]$AppName,
        [string]$AppPath
    )
    
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Building $AppName" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    Push-Location $AppPath
    
    Write-Host "Step 1/4: Cleaning Flutter build..." -ForegroundColor Yellow
    flutter clean | Out-Null
    
    Write-Host "Step 2/4: Getting dependencies..." -ForegroundColor Yellow
    flutter pub get
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Failed to get dependencies!" -ForegroundColor Red
        Pop-Location
        return $false
    }
    
    Write-Host "Step 3/4: Cleaning Android build..." -ForegroundColor Yellow
    if (Test-Path "android\build") {
        Remove-Item -Path "android\build" -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "build") {
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Step 4/4: Building release APK (this may take 5-15 minutes)..." -ForegroundColor Yellow
    flutter build apk --release
    
    if ($LASTEXITCODE -eq 0) {
        $apkPath = "build\app\outputs\flutter-apk\app-release.apk"
        if (Test-Path $apkPath) {
            $apkInfo = Get-Item $apkPath
            $sizeMB = [math]::Round($apkInfo.Length / 1MB, 2)
            Write-Host "  ✓ Build successful!" -ForegroundColor Green
            Write-Host "  Location: $apkPath" -ForegroundColor Gray
            Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
            Write-Host "  Modified: $($apkInfo.LastWriteTime)" -ForegroundColor Gray
            Pop-Location
            return $true
        }
    }
    
    Write-Host "  ✗ Build failed!" -ForegroundColor Red
    Pop-Location
    return $false
}

# Main execution
$startTime = Get-Date

# Clean Gradle cache first
Clean-GradleCache

# Build Pro Mobile
$proSuccess = Build-APK -AppName "Pro Mobile (Salon Staff)" -AppPath "c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile"

# Build Client Mobile
$clientSuccess = Build-APK -AppName "Client Mobile (End User)" -AppPath "c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile"

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Build Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Pro Mobile:    $(if($proSuccess){"✓ SUCCESS"}else{"✗ FAILED"})" -ForegroundColor $(if($proSuccess){"Green"}else{"Red"})
Write-Host "Client Mobile: $(if($clientSuccess){"✓ SUCCESS"}else{"✗ FAILED"})" -ForegroundColor $(if($clientSuccess){"Green"}else{"Red"})
Write-Host "Total time:    $($duration.Minutes)m $($duration.Seconds)s" -ForegroundColor Gray
Write-Host ""

if ($proSuccess -and $clientSuccess) {
    Write-Host "🎉 All APKs built successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Demo Accounts:" -ForegroundColor Cyan
    Write-Host "  Pro:    demo.pro@reza.ma / demo1234" -ForegroundColor Gray
    Write-Host "  Client: demo.client@reza.ma / demo1234" -ForegroundColor Gray
} elseif (!$proSuccess -and !$clientSuccess) {
    Write-Host "⚠️  Both builds failed. Try manually:" -ForegroundColor Yellow
    Write-Host "  cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile" -ForegroundColor Gray
    Write-Host "  flutter clean && flutter pub get && flutter build apk --release" -ForegroundColor Gray
} else {
    Write-Host "⚠️  One build failed. Check the error messages above." -ForegroundColor Yellow
}

Write-Host ""
