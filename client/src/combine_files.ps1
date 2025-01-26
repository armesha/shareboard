$outputFile = "combined_code.txt"

# Create or clear the output file
"" | Set-Content $outputFile

# Function to get all .jsx files from a directory
function Get-JsxFiles {
    param (
        [string]$dirPath,
        [string]$dirName
    )
    return Get-ChildItem -Path $dirPath -Filter "*.jsx" -File
}

# Function to get specific files from root directory
function Get-RootFiles {
    $files = @(
        "App.jsx",
        "main.jsx",
        "index.css",
        "index.html",
        "index.js"
    )
    return $files | ForEach-Object {
        Get-Item $_ -ErrorAction SilentlyContinue
    } | Where-Object { $_ -ne $null }
}

# First, list all files that will be processed
"FILES TO BE PROCESSED:" | Add-Content $outputFile
"===================" | Add-Content $outputFile

# List root files
Get-RootFiles | ForEach-Object {
    "[root] $($_.Name)" | Add-Content $outputFile
}

# List directory files
@("components", "context", "pages") | ForEach-Object {
    $dirName = $_
    Get-JsxFiles -dirPath $dirName -dirName $dirName | ForEach-Object {
        "[$dirName] $($_.Name)" | Add-Content $outputFile
    }
}

"`n`nFILE CONTENTS:" | Add-Content $outputFile
"=============" | Add-Content $outputFile

# Function to process files in a directory
function Process-Directory {
    param (
        [string]$dirPath,
        [string]$dirName
    )
    
    Get-JsxFiles -dirPath $dirPath -dirName $dirName | ForEach-Object {
        $separator = "`n`n" + "="*80 + "`n"
        $header = "[$dirName] $($_.Name)"
        $separator + "`n" + $header + "`n" + "="*80 + "`n`n" | Add-Content $outputFile
        Get-Content $_.FullName | Add-Content $outputFile
    }
}

# Process root files first
Get-RootFiles | ForEach-Object {
    $separator = "`n`n" + "="*80 + "`n"
    $header = "[root] $($_.Name)"
    $separator + "`n" + $header + "`n" + "="*80 + "`n`n" | Add-Content $outputFile
    Get-Content $_.FullName | Add-Content $outputFile
}

# Process each directory
@("components", "context", "pages") | ForEach-Object {
    Process-Directory -dirPath $_ -dirName $_
}

Write-Host "Files have been combined into $outputFile"
