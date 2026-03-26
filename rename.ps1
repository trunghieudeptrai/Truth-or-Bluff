$dir = "d:\Privos Dev\Truth or Bluff\image\card"
Get-ChildItem -Path $dir -Filter "*.png" | ForEach-Object {
    $name = $_.Name.ToLower()
    $suit = "unknown"
    if ($name -match "bích") { $suit = "spades" }
    elseif ($name -match "chuồn") { $suit = "clubs" }
    elseif ($name -match "tép") { $suit = "diamonds" }
    elseif ($name -match "cơ") { $suit = "hearts" }
    
    $rank = "X"
    if ($name -match "10") { $rank = "10" }
    elseif ($name -match "joker") { $rank = "J" }
    elseif ($name -match "queen") { $rank = "Q" }
    elseif ($name -match "king") { $rank = "K" }
    elseif ($name.StartsWith("a ")) { $rank = "A" }
    else {
        # check 2-9
        for ($i = 2; $i -le 9; $i++) {
            if ($name -match "^$i ") { $rank = "$i"; break }
        }
    }
    
    if ($suit -ne "unknown" -and $rank -ne "X") {
        $newName = "${rank}_${suit}.png"
        Rename-Item -Path $_.FullName -NewName $newName
        Write-Host "Renamed $($_.Name) -> $newName"
    }
}
