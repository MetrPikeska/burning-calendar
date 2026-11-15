# Creates ~/.cdsapirc for the Copernicus EWDS API. The key is typed hidden, never shown and never
# written anywhere except that one file in your home directory (outside the repository).
#
# Usage (PowerShell):  .\scripts\set-cdsapirc.ps1
# Key: ewds.climate.copernicus.eu -> your profile -> API token.

$target = Join-Path $HOME ".cdsapirc"

if (Test-Path $target) {
    $answer = Read-Host "$target exists. Overwrite? (y/N)"
    if ($answer -notmatch '^[yY]') { Write-Host "Cancelled, file unchanged."; exit 0 }
}

$secure = Read-Host "Paste your EWDS API key (hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($key)) { Write-Error "Empty key, nothing written."; exit 1 }
if ($key -match '\s') { Write-Error "The key contains whitespace, check what you pasted. Nothing written."; exit 1 }

# UTF-8 without BOM, LF line endings, as cdsapi expects.
$text = "url: https://ewds.climate.copernicus.eu/api`nkey: $key`n"
[IO.File]::WriteAllText($target, $text, (New-Object Text.UTF8Encoding($false)))
$key = $null

Write-Host "Wrote $target (the key is not displayed)."
Write-Host "Accept the licence on https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1 (Download tab), then run:"
Write-Host "  uv run python pipeline/download_factors.py fwi"
