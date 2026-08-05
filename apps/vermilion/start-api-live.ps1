Set-Location -LiteralPath $PSScriptRoot
$env:VERMILION_PORT = '8100'
$env:VERMILION_REQUIRE_AUTH = 'true'
python .\vermilion_api.py
