cd "d:\Privos Dev\Truth or Bluff\image\card"
$files = Get-ChildItem -Filter "*.png"
foreach ($f in $files) {
    $n = $f.Name
    $suit = "x"; $rank = "x"
    
    if ($n.Contains("b")) { $suit = "spades" }
    elseif ($n.Contains("chu")) { $suit = "clubs" }
    elseif ($n.Contains("t")) { $suit = "diamonds" }
    elseif ($n.Contains("c")) { $suit = "hearts" }
    
    if ($n.StartsWith("10 ")) { $rank = "10" }
    elseif ($n.StartsWith("2 ")) { $rank = "2" }
    elseif ($n.StartsWith("3 ")) { $rank = "3" }
    elseif ($n.StartsWith("4 ")) { $rank = "4" }
    elseif ($n.StartsWith("5 ")) { $rank = "5" }
    elseif ($n.StartsWith("6 ")) { $rank = "6" }
    elseif ($n.StartsWith("7 ")) { $rank = "7" }
    elseif ($n.StartsWith("8 ")) { $rank = "8" }
    elseif ($n.StartsWith("9 ")) { $rank = "9" }
    elseif ($n.StartsWith("A ")) { $rank = "A" }
    elseif ($n.ToLower().StartsWith("joker")) { $rank = "J" }
    elseif ($n.ToLower().StartsWith("queen")) { $rank = "Q" }
    elseif ($n.ToLower().StartsWith("king")) { $rank = "K" }
    
    if ($suit -ne "x" -and $rank -ne "x") {
        git mv $n "${rank}_${suit}.png"
    } else {
        Write-Host "Failed to parse: $n"
    }
}
