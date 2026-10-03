$lines = Get-Content "C:\Users\wmjef\.gemini\antigravity\brain\61348fa8-40fc-4e1e-8713-81b44cd42555\.system_generated\logs\transcript.jsonl"
foreach ($line in $lines) {
    if ($line -match "Lionfish-Setup") {
        Write-Host $line
        break
    }
}
