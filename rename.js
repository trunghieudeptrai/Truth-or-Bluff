const fs = require('fs');
const path = require('path');

const dir = 'd:/Privos Dev/Truth or Bluff/image/card';
const files = fs.readdirSync(dir);

const normalizeSuit = (str) => {
  if (str.includes('bích')) return 'spades';
  if (str.includes('chuồn')) return 'clubs';
  if (str.includes('tép')) return 'diamonds';
  if (str.includes('cơ')) return 'hearts';
  return 'unknown';
};

const normalizeRank = (str) => {
  const lower = str.toLowerCase();
  if (lower.includes('10')) return '10';
  if (lower.includes('joker')) return 'J';
  if (lower.includes('queen')) return 'Q';
  if (lower.includes('king')) return 'K';
  if (lower.includes('a ')) return 'A';
  for (let i = 2; i <= 9; i++) {
    if (lower.includes(i.toString())) return i.toString();
  }
  return 'X';
};

files.forEach(f => {
  if (!f.endsWith('.png')) return;
  const suit = normalizeSuit(f);
  const rank = normalizeRank(f);
  if (suit !== 'unknown' && rank !== 'X') {
    const newName = `${rank}_${suit}.png`;
    fs.renameSync(path.join(dir, f), path.join(dir, newName));
    console.log(`Renamed ${f} -> ${newName}`);
  } else {
    console.log(`Could not parse: ${f}`);
  }
});
