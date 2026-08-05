Set-Location -LiteralPath $PSScriptRoot
$env:VERMILION_PORT = '8105'
$env:VERMILION_REQUIRE_AUTH = 'false'
python .\vermilion_api.py
