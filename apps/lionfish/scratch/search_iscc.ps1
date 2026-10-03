$lines = Get-Content "C:\Users\wmjef\.gemini\antigravity\brain\61348fa8-40fc-4e1e-8713-81b44cd42555\.system_generated\logs\transcript.jsonl"
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "ISCC") {
        Write-Host "Line $i`: $($lines[$i])"
    }
}
