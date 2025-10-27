Write-Host "Merging and minifying all JS files..."

# Path to your JS folder
$jsPath = ".\js_src"
$outFile = "autofill.min.js"

# Combine all JS files in order (alphabetical)
$files = Get-ChildItem -Path $jsPath -Filter *.js | Sort-Object Name
$combined = ""

foreach ($file in $files) {
    Write-Host "Adding $($file.Name)..."
    # ✅ Properly wrap Get-Content in parentheses before concatenating
    $combined += (Get-Content -Path $file.FullName -Raw) + "`n"
}

# Minify using Toptal's free API
if ($combined.Trim().Length -eq 0) {
    Write-Host "⚠️ No JavaScript found to minify!"
    exit
}

Write-Host "Sending to online minifier..."
$response = Invoke-RestMethod -Uri "https://www.toptal.com/developers/javascript-minifier/api/raw" `
    -Method Post `
    -Body @{ input = $combined }

# Save output
Set-Content -Path $outFile -Value $response -Encoding UTF8
Write-Host "Minified JS saved to $outFile"
