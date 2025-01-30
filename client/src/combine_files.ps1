$outputFile = "combined_code.txt"

"" | Set-Content $outputFile

function Get-JsxFiles {
    param (
        [string]$dirPath,
        [string]$dirName
    )
    return Get-ChildItem -Path $dirPath -Filter "*.jsx" -File
}

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

"FILES TO BE PROCESSED:" | Add-Content $outputFile
"===================" | Add-Content $outputFile

Get-RootFiles | ForEach-Object {
    "[root] $($_.Name)" | Add-Content $outputFile
}

@("components", "context", "pages") | ForEach-Object {
    $dirName = $_
    Get-JsxFiles -dirPath $dirName -dirName $dirName | ForEach-Object {
        "[$dirName] $($_.Name)" | Add-Content $outputFile
    }
}

"`n`nFILE CONTENTS:" | Add-Content $outputFile
"=============" | Add-Content $outputFile

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

Get-RootFiles | ForEach-Object {
    $separator = "`n`n" + "="*80 + "`n"
    $header = "[root] $($_.Name)"
    $separator + "`n" + $header + "`n" + "="*80 + "`n`n" | Add-Content $outputFile
    Get-Content $_.FullName | Add-Content $outputFile
}

@("components", "context", "pages") | ForEach-Object {
    Process-Directory -dirPath $_ -dirName $_
}

Write-Host "Files have been combined into $outputFile"
