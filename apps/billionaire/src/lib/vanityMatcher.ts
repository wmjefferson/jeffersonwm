export interface VanityMatch {
  word: string;
  startIndex: number;
  endIndex: number;
  digitSpan: string;
  wordLength: number;
  isFullMatch: boolean;
  isSuffixMatch: boolean;
  isPrefixMatch: boolean;
  method: 'dtmf' | 'a1z26' | 'hybrid';
  breakdown: string;
}

interface TrieNode {
  isWord?: boolean;
  children: Record<string, TrieNode>;
}

const DTMF_MAP: Record<string, string[]> = {
  '2': ['A', 'B', 'C'],
  '3': ['D', 'E', 'F'],
  '4': ['G', 'H', 'I'],
  '5': ['J', 'K', 'L'],
  '6': ['M', 'N', 'O'],
  '7': ['P', 'Q', 'R', 'S'],
  '8': ['T', 'U', 'V'],
  '9': ['W', 'X', 'Y', 'Z'],
};

const A1Z26_ONE_MAP: Record<string, string> = {
  '1': 'A',
  '2': 'B',
  '3': 'C',
  '4': 'D',
  '5': 'E',
  '6': 'F',
  '7': 'G',
  '8': 'H',
  '9': 'I',
};

const A1Z26_TWO_MAP: Record<string, string> = {
  '10': 'J',
  '11': 'K',
  '12': 'L',
  '13': 'M',
  '14': 'N',
  '15': 'O',
  '16': 'P',
  '17': 'Q',
  '18': 'R',
  '19': 'S',
  '20': 'T',
  '21': 'U',
  '22': 'V',
  '23': 'W',
  '24': 'X',
  '25': 'Y',
  '26': 'Z',
};

let trieRoot: TrieNode | null = null;
let triePromise: Promise<TrieNode> | null = null;

async function loadWordList() {
  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const response = await fetch(`${normalizedBasePath}word-list.txt`);
  if (!response.ok) {
    throw new Error('Could not load word list.');
  }
  return response.text();
}

async function buildTrie(): Promise<TrieNode> {
  if (trieRoot) return trieRoot;

  const root: TrieNode = { children: {} };
  const words = (await loadWordList()).split(',');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 3) continue;

    let node = root;
    for (let c = 0; c < word.length; c++) {
      const char = word[c];
      if (!node.children[char]) {
        node.children[char] = { children: {} };
      }
      node = node.children[char];
    }
    node.isWord = true;
  }

  trieRoot = root;
  return root;
}

async function getTrie(): Promise<TrieNode> {
  if (!triePromise) {
    triePromise = buildTrie();
  }
  return triePromise;
}

export async function findVanityWords(rawInput: string, minLength = 3): Promise<VanityMatch[]> {
  const digits = rawInput.replace(/\D/g, '');
  if (digits.length < minLength) return [];

  const trie = await getTrie();
  const rawMatches: VanityMatch[] = [];
  const seenKeys = new Set<string>();

  for (let start = 0; start < digits.length; start++) {
    const dfs = (
      pos: number,
      node: TrieNode,
      currentWord: string,
      steps: Array<{ digits: string; letter: string; type: 'dtmf' | 'a1z26' }>
    ) => {
      if (node.isWord && currentWord.length >= minLength) {
        const hasDtmf = steps.some((s) => s.type === 'dtmf');
        const hasA1Z26 = steps.some((s) => s.type === 'a1z26');
        const method: 'dtmf' | 'a1z26' | 'hybrid' =
          hasDtmf && hasA1Z26 ? 'hybrid' : hasDtmf ? 'dtmf' : 'a1z26';

        const breakdown = steps.map((s) => `${s.digits}(${s.letter})`).join('-');
        const isFullMatch = start === 0 && pos === digits.length;
        const isSuffixMatch = pos === digits.length;
        const isPrefixMatch = start === 0;

        const key = `${currentWord}:${start}:${pos}:${method}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          rawMatches.push({
            word: currentWord,
            startIndex: start,
            endIndex: pos,
            digitSpan: digits.slice(start, pos),
            wordLength: currentWord.length,
            isFullMatch,
            isSuffixMatch,
            isPrefixMatch,
            method,
            breakdown,
          });
        }
      }

      if (pos >= digits.length) return;

      // 1. Two-digit A1Z26 branch (10..26)
      if (pos + 2 <= digits.length) {
        const chunk = digits.slice(pos, pos + 2);
        const letter = A1Z26_TWO_MAP[chunk];
        if (letter && node.children[letter]) {
          dfs(
            pos + 2,
            node.children[letter],
            currentWord + letter,
            [...steps, { digits: chunk, letter, type: 'a1z26' }]
          );
        }
      }

      // 2. One-digit A1Z26 branch (1..9)
      const d = digits[pos];
      const a1z26Letter = A1Z26_ONE_MAP[d];
      if (a1z26Letter && node.children[a1z26Letter]) {
        dfs(
          pos + 1,
          node.children[a1z26Letter],
          currentWord + a1z26Letter,
          [...steps, { digits: d, letter: a1z26Letter, type: 'a1z26' }]
        );
      }

      // 3. One-digit DTMF branch (2..9)
      const dtmfLetters = DTMF_MAP[d];
      if (dtmfLetters) {
        for (let i = 0; i < dtmfLetters.length; i++) {
          const dtmfLetter = dtmfLetters[i];
          if (node.children[dtmfLetter]) {
            dfs(
              pos + 1,
              node.children[dtmfLetter],
              currentWord + dtmfLetter,
              [...steps, { digits: d, letter: dtmfLetter, type: 'dtmf' }]
            );
          }
        }
      }
    };

    dfs(start, trie, '', []);
  }

  // Deduplicate and rank:
  rawMatches.sort((a, b) => {
    if (a.isFullMatch !== b.isFullMatch) return a.isFullMatch ? -1 : 1;
    if (a.wordLength !== b.wordLength) return b.wordLength - a.wordLength;
    if (a.isSuffixMatch !== b.isSuffixMatch) return a.isSuffixMatch ? -1 : 1;
    if (a.isPrefixMatch !== b.isPrefixMatch) return a.isPrefixMatch ? -1 : 1;
    return a.word.localeCompare(b.word);
  });

  const uniqueWords = new Set<string>();
  const results: VanityMatch[] = [];

  for (let i = 0; i < rawMatches.length; i++) {
    const match = rawMatches[i];
    const wordKey = `${match.word}:${match.startIndex}:${match.endIndex}`;
    if (!uniqueWords.has(wordKey)) {
      uniqueWords.add(wordKey);
      results.push(match);
    }
  }

  return results;
}
