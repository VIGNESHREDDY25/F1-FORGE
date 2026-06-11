import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rawGet, rawSet } from '../db/store';

const router = Router();
router.use(authenticate);

// ─── Languages (mapped to Piston runtimes) ───────────────────────────────────
export const LANGUAGES = [
  { id: 'python', label: 'Python', piston: 'python', version: '3.10.0', ext: 'py', wandbox: 'cpython-3.14.0' },
  { id: 'javascript', label: 'JavaScript', piston: 'javascript', version: '18.15.0', ext: 'js', wandbox: 'nodejs-18.20.4' },
  { id: 'java', label: 'Java', piston: 'java', version: '15.0.2', ext: 'java', wandbox: 'openjdk-jdk-22+36' },
  { id: 'cpp', label: 'C++', piston: 'c++', version: '10.2.0', ext: 'cpp', wandbox: 'gcc-13.2.0' },
] as const;

type Lang = (typeof LANGUAGES)[number];
interface RunResult { stdout: string; stderr: string; code: number; provider: string; }

// ── Provider 1: self-hosted Piston (set PISTON_URL; e.g. docker-compose) ──────
async function runViaPiston(baseUrl: string, lang: Lang, source: string, stdin: string): Promise<RunResult> {
  let version = lang.version;
  try {
    let runtimes = rawGet('piston_runtimes', baseUrl);
    if (!runtimes || Date.now() - runtimes.fetchedAt > 6 * 60 * 60 * 1000) {
      const rt = await fetch(`${baseUrl}/api/v2/runtimes`, { signal: AbortSignal.timeout(8000) });
      runtimes = { list: await rt.json(), fetchedAt: Date.now() };
      rawSet('piston_runtimes', baseUrl, runtimes);
    }
    const m = (runtimes.list as any[]).find(r => r.language === lang.piston || (r.aliases || []).includes(lang.piston));
    if (m?.version) version = m.version;
  } catch { /* use pinned */ }

  const resp = await fetch(`${baseUrl}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: lang.piston, version,
      files: [{ name: `main.${lang.ext}`, content: source }],
      stdin, compile_timeout: 10000, run_timeout: 8000,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`piston ${resp.status}`);
  const d = (await resp.json()) as any;
  const run = d.run || {}, compile = d.compile || {};
  return {
    stdout: (run.stdout || '').trimEnd(),
    stderr: (compile.stderr || run.stderr || '').trimEnd(),
    code: run.code ?? 0,
    provider: 'piston',
  };
}

// ── Provider 2: Wandbox public API (free, no key, works out of the box) ───────
async function runViaWandbox(lang: Lang, source: string, stdin: string): Promise<RunResult> {
  // Wandbox writes the source to prog.<ext>; a `public class` would force a
  // filename match, so drop `public` from the top-level Java class.
  const code = lang.id === 'java' ? source.replace(/\bpublic\s+class\b/, 'class') : source;

  const exec = async () => {
    const resp = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, compiler: lang.wandbox, stdin }),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`wandbox ${resp.status}`);
    return (await resp.json()) as any;
  };

  // Wandbox's free shared runner intermittently fails with a transient OCI
  // "Resource temporarily unavailable" — retry a few times with backoff.
  const isTransient = (d: any) =>
    /Resource temporarily|OCI runtime|cannot allocate|clone:/i.test(
      `${d?.program_message || ''}${d?.program_output || ''}${d?.program_error || ''}`
    );
  let d = await exec();
  for (let i = 0; i < 3 && isTransient(d); i++) {
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
    d = await exec();
  }
  if (isTransient(d)) throw new Error('wandbox transient runner error');

  return {
    stdout: (d.program_output || '').trimEnd(),
    stderr: (d.compiler_error || d.program_error || '').trimEnd(),
    code: parseInt(d.status ?? '0', 10) || 0,
    provider: 'wandbox',
  };
}

// ─── Curated "top DSA" problem set ───────────────────────────────────────────
interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  prompt: string;
  examples: { input: string; output: string; explanation?: string }[];
  hints: string[];
  starter: Record<string, string>;
}

// Fully-runnable, hand-crafted problems. Used as the offline fallback and as the
// "Featured" set (these have a main() so Run produces output immediately).
const FALLBACK_PROBLEMS: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays & Hashing',
    prompt:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. You may assume exactly one solution exists.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    hints: ['Brute force is O(n²). Can a hash map get you to O(n)?', 'Store value → index as you scan; check if target - num was seen.'],
    starter: {
      python: `def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []\n\nprint(two_sum([2, 7, 11, 15], 9))`,
      javascript: `function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n\nconsole.log(twoSum([2, 7, 11, 15], 9));`,
      java: `import java.util.*;\n\npublic class Main {\n  public static int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> seen = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n      if (seen.containsKey(target - nums[i])) return new int[]{seen.get(target - nums[i]), i};\n      seen.put(nums[i], i);\n    }\n    return new int[]{};\n  }\n  public static void main(String[] args) {\n    System.out.println(Arrays.toString(twoSum(new int[]{2,7,11,15}, 9)));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n  unordered_map<int,int> seen;\n  for (int i = 0; i < nums.size(); i++) {\n    if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};\n    seen[nums[i]] = i;\n  }\n  return {};\n}\n\nint main() {\n  vector<int> nums = {2,7,11,15};\n  auto r = twoSum(nums, 9);\n  cout << "[" << r[0] << "," << r[1] << "]" << endl;\n}`,
    },
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topic: 'Stack',
    prompt:
      'Given a string `s` containing just `()[]{}`, determine if the input string is valid — brackets must close in the correct order.',
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    hints: ['A stack is the natural fit.', 'Push opens; on a close, the top must be its matching open.'],
    starter: {
      python: `def is_valid(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for c in s:\n        if c in pairs:\n            if not stack or stack.pop() != pairs[c]:\n                return False\n        else:\n            stack.append(c)\n    return not stack\n\nprint(is_valid("()[]{}"))`,
      javascript: `function isValid(s) {\n  const pairs = { ')': '(', ']': '[', '}': '{' };\n  const stack = [];\n  for (const c of s) {\n    if (c in pairs) {\n      if (stack.pop() !== pairs[c]) return false;\n    } else stack.push(c);\n  }\n  return stack.length === 0;\n}\n\nconsole.log(isValid("()[]{}"));`,
      java: `import java.util.*;\n\npublic class Main {\n  public static boolean isValid(String s) {\n    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');\n    Deque<Character> stack = new ArrayDeque<>();\n    for (char c : s.toCharArray()) {\n      if (pairs.containsKey(c)) {\n        if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;\n      } else stack.push(c);\n    }\n    return stack.isEmpty();\n  }\n  public static void main(String[] args) {\n    System.out.println(isValid("()[]{}"));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nbool isValid(string s) {\n  unordered_map<char,char> pairs = {{')','('},{']','['},{'}','{'}};\n  stack<char> st;\n  for (char c : s) {\n    if (pairs.count(c)) {\n      if (st.empty() || st.top() != pairs[c]) return false;\n      st.pop();\n    } else st.push(c);\n  }\n  return st.empty();\n}\n\nint main() {\n  cout << (isValid("()[]{}") ? "true" : "false") << endl;\n}`,
    },
  },
  {
    id: 'best-time-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    topic: 'Sliding Window',
    prompt:
      'Given an array `prices` where `prices[i]` is the price on day `i`, return the maximum profit from a single buy-then-sell. Return 0 if no profit is possible.',
    examples: [
      { input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: 'Buy at 1, sell at 6.' },
      { input: 'prices = [7,6,4,3,1]', output: '0' },
    ],
    hints: ['Track the minimum price seen so far.', 'Best profit = max(price - min_so_far).'],
    starter: {
      python: `def max_profit(prices):\n    min_price = float('inf')\n    best = 0\n    for p in prices:\n        min_price = min(min_price, p)\n        best = max(best, p - min_price)\n    return best\n\nprint(max_profit([7, 1, 5, 3, 6, 4]))`,
      javascript: `function maxProfit(prices) {\n  let min = Infinity, best = 0;\n  for (const p of prices) {\n    min = Math.min(min, p);\n    best = Math.max(best, p - min);\n  }\n  return best;\n}\n\nconsole.log(maxProfit([7, 1, 5, 3, 6, 4]));`,
      java: `public class Main {\n  public static int maxProfit(int[] prices) {\n    int min = Integer.MAX_VALUE, best = 0;\n    for (int p : prices) { min = Math.min(min, p); best = Math.max(best, p - min); }\n    return best;\n  }\n  public static void main(String[] args) {\n    System.out.println(maxProfit(new int[]{7,1,5,3,6,4}));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint maxProfit(vector<int>& prices) {\n  int mn = INT_MAX, best = 0;\n  for (int p : prices) { mn = min(mn, p); best = max(best, p - mn); }\n  return best;\n}\n\nint main() {\n  vector<int> p = {7,1,5,3,6,4};\n  cout << maxProfit(p) << endl;\n}`,
    },
  },
  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    topic: 'Linked List',
    prompt:
      'Reverse a singly linked list and return the new head. Below, the list is modeled as a Python list / array for easy testing.',
    examples: [{ input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' }],
    hints: ['Iterate with prev/curr pointers.', 'Save next before rewiring curr.next = prev.'],
    starter: {
      python: `def reverse(head):\n    prev = None\n    for val in head:          # head modeled as a list here\n        prev = [val] + (prev or [])\n    return prev or []\n\nprint(reverse([1, 2, 3, 4, 5]))`,
      javascript: `function reverse(head) {\n  let prev = [];\n  for (const val of head) prev = [val, ...prev];\n  return prev;\n}\n\nconsole.log(reverse([1, 2, 3, 4, 5]));`,
      java: `import java.util.*;\n\npublic class Main {\n  public static List<Integer> reverse(int[] head) {\n    LinkedList<Integer> out = new LinkedList<>();\n    for (int v : head) out.addFirst(v);\n    return out;\n  }\n  public static void main(String[] args) {\n    System.out.println(reverse(new int[]{1,2,3,4,5}));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  vector<int> head = {1,2,3,4,5};\n  reverse(head.begin(), head.end());\n  cout << "[";\n  for (int i = 0; i < head.size(); i++) cout << head[i] << (i+1<head.size()?",":"");\n  cout << "]" << endl;\n}`,
    },
  },
  {
    id: 'max-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    prompt:
      "Find the contiguous subarray with the largest sum and return that sum (Kadane's algorithm).",
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'Subarray [4,-1,2,1] sums to 6.' },
    ],
    hints: ['At each index: extend the previous subarray or start fresh.', 'cur = max(num, cur + num); best = max(best, cur).'],
    starter: {
      python: `def max_subarray(nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best\n\nprint(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))`,
      javascript: `function maxSubArray(nums) {\n  let best = nums[0], cur = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    cur = Math.max(nums[i], cur + nums[i]);\n    best = Math.max(best, cur);\n  }\n  return best;\n}\n\nconsole.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4]));`,
      java: `public class Main {\n  public static int maxSubArray(int[] nums) {\n    int best = nums[0], cur = nums[0];\n    for (int i = 1; i < nums.length; i++) {\n      cur = Math.max(nums[i], cur + nums[i]);\n      best = Math.max(best, cur);\n    }\n    return best;\n  }\n  public static void main(String[] args) {\n    System.out.println(maxSubArray(new int[]{-2,1,-3,4,-1,2,1,-5,4}));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint maxSubArray(vector<int>& nums) {\n  int best = nums[0], cur = nums[0];\n  for (int i = 1; i < nums.size(); i++) {\n    cur = max(nums[i], cur + nums[i]);\n    best = max(best, cur);\n  }\n  return best;\n}\n\nint main() {\n  vector<int> nums = {-2,1,-3,4,-1,2,1,-5,4};\n  cout << maxSubArray(nums) << endl;\n}`,
    },
  },
  {
    id: 'group-anagrams',
    title: 'Group Anagrams',
    difficulty: 'Medium',
    topic: 'Hashing',
    prompt: 'Given an array of strings, group the anagrams together. Return the groups in any order.',
    examples: [{ input: '["eat","tea","tan","ate","nat","bat"]', output: '[["eat","tea","ate"],["tan","nat"],["bat"]]' }],
    hints: ['Anagrams share the same sorted characters.', 'Use the sorted string as a hash-map key.'],
    starter: {
      python: `from collections import defaultdict\n\ndef group_anagrams(strs):\n    groups = defaultdict(list)\n    for s in strs:\n        groups[''.join(sorted(s))].append(s)\n    return list(groups.values())\n\nprint(group_anagrams(["eat","tea","tan","ate","nat","bat"]))`,
      javascript: `function groupAnagrams(strs) {\n  const groups = {};\n  for (const s of strs) {\n    const key = [...s].sort().join('');\n    (groups[key] ||= []).push(s);\n  }\n  return Object.values(groups);\n}\n\nconsole.log(groupAnagrams(["eat","tea","tan","ate","nat","bat"]));`,
      java: `import java.util.*;\n\npublic class Main {\n  public static List<List<String>> groupAnagrams(String[] strs) {\n    Map<String, List<String>> groups = new HashMap<>();\n    for (String s : strs) {\n      char[] c = s.toCharArray(); Arrays.sort(c);\n      groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(s);\n    }\n    return new ArrayList<>(groups.values());\n  }\n  public static void main(String[] args) {\n    System.out.println(groupAnagrams(new String[]{"eat","tea","tan","ate","nat","bat"}));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  vector<string> strs = {"eat","tea","tan","ate","nat","bat"};\n  unordered_map<string, vector<string>> groups;\n  for (auto s : strs) { string k = s; sort(k.begin(), k.end()); groups[k].push_back(s); }\n  for (auto& [k, v] : groups) {\n    cout << "["; for (int i=0;i<v.size();i++) cout << v[i] << (i+1<v.size()?",":""); cout << "] ";\n  }\n  cout << endl;\n}`,
    },
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    topic: 'Binary Search',
    prompt: 'Given a sorted array `nums` and a `target`, return its index, or -1 if it is not present. Must run in O(log n).',
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1' },
    ],
    hints: ['Maintain lo/hi pointers.', 'Compare mid to target; halve the search space each step.'],
    starter: {
      python: `def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nprint(search([-1, 0, 3, 5, 9, 12], 9))`,
      javascript: `function search(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}\n\nconsole.log(search([-1,0,3,5,9,12], 9));`,
      java: `public class Main {\n  public static int search(int[] nums, int target) {\n    int lo = 0, hi = nums.length - 1;\n    while (lo <= hi) {\n      int mid = (lo + hi) >>> 1;\n      if (nums[mid] == target) return mid;\n      if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n  }\n  public static void main(String[] args) {\n    System.out.println(search(new int[]{-1,0,3,5,9,12}, 9));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint search(vector<int>& nums, int target) {\n  int lo = 0, hi = nums.size() - 1;\n  while (lo <= hi) {\n    int mid = (lo + hi) / 2;\n    if (nums[mid] == target) return mid;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}\n\nint main() {\n  vector<int> nums = {-1,0,3,5,9,12};\n  cout << search(nums, 9) << endl;\n}`,
    },
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    topic: 'Dynamic Programming',
    prompt:
      'You are climbing a staircase that takes `n` steps. Each time you can climb 1 or 2 steps. In how many distinct ways can you reach the top?',
    examples: [
      { input: 'n = 3', output: '3', explanation: '1+1+1, 1+2, 2+1' },
      { input: 'n = 5', output: '8' },
    ],
    hints: ['This is the Fibonacci sequence.', 'ways(n) = ways(n-1) + ways(n-2).'],
    starter: {
      python: `def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint(climb_stairs(5))`,
      javascript: `function climbStairs(n) {\n  let a = 1, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;\n}\n\nconsole.log(climbStairs(5));`,
      java: `public class Main {\n  public static int climbStairs(int n) {\n    int a = 1, b = 1;\n    for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n    return a;\n  }\n  public static void main(String[] args) {\n    System.out.println(climbStairs(5));\n  }\n}`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint climbStairs(int n) {\n  int a = 1, b = 1;\n  for (int i = 0; i < n; i++) { int t = a + b; a = b; b = t; }\n  return a;\n}\n\nint main() { cout << climbStairs(5) << endl; }`,
    },
  },
];

// ─── Canonical topic list (LeetCode tag slugs + display labels) ──────────────
interface TopicTag { slug: string; label: string }
const TOPICS: TopicTag[] = [
  { slug: 'array',                  label: 'Arrays' },
  { slug: 'string',                 label: 'Strings' },
  { slug: 'hash-table',             label: 'Hash Table' },
  { slug: 'dynamic-programming',    label: 'Dynamic Programming' },
  { slug: 'math',                   label: 'Math' },
  { slug: 'sorting',                label: 'Sorting' },
  { slug: 'greedy',                 label: 'Greedy' },
  { slug: 'depth-first-search',     label: 'DFS' },
  { slug: 'binary-search',          label: 'Binary Search' },
  { slug: 'breadth-first-search',   label: 'BFS' },
  { slug: 'tree',                   label: 'Trees' },
  { slug: 'binary-tree',            label: 'Binary Tree' },
  { slug: 'matrix',                 label: 'Matrix' },
  { slug: 'two-pointers',           label: 'Two Pointers' },
  { slug: 'bit-manipulation',       label: 'Bit Manipulation' },
  { slug: 'heap-priority-queue',    label: 'Heap / Priority Queue' },
  { slug: 'stack',                  label: 'Stack' },
  { slug: 'graph',                  label: 'Graphs' },
  { slug: 'backtracking',           label: 'Backtracking' },
  { slug: 'sliding-window',         label: 'Sliding Window' },
  { slug: 'linked-list',            label: 'Linked List' },
  { slug: 'recursion',              label: 'Recursion' },
  { slug: 'trie',                   label: 'Trie' },
  { slug: 'binary-search-tree',     label: 'BST' },
  { slug: 'divide-and-conquer',     label: 'Divide & Conquer' },
  { slug: 'monotonic-stack',        label: 'Monotonic Stack' },
  { slug: 'prefix-sum',             label: 'Prefix Sum' },
  { slug: 'union-find',             label: 'Union Find' },
  { slug: 'topological-sort',       label: 'Topological Sort' },
  { slug: 'database',               label: 'Database' },
];

// GET /topics — return canonical topic list
router.get('/topics', (_req: AuthRequest, res: Response) => {
  res.json({ topics: TOPICS });
});

// ─── LeetCode-backed problem catalog (~1,800 free problems) ──────────────────
const DIFFICULTY_MAP: Record<number, 'Easy' | 'Medium' | 'Hard'> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const LC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Referer: 'https://leetcode.com',
  'Content-Type': 'application/json',
};

interface CatalogItem { slug: string; title: string; difficulty: 'Easy' | 'Medium' | 'Hard'; frontendId: number; acRate: number; }

async function getCatalog(): Promise<CatalogItem[]> {
  const cached = rawGet('leetcode_cache', 'catalog');
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) return cached.items;

  const resp = await fetch('https://leetcode.com/api/problems/all/', { headers: LC_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`leetcode list ${resp.status}`);
  const data = (await resp.json()) as any;
  const items: CatalogItem[] = (data.stat_status_pairs || [])
    .filter((p: any) => !p.paid_only)
    .map((p: any) => ({
      slug: p.stat.question__title_slug,
      title: p.stat.question__title,
      difficulty: DIFFICULTY_MAP[p.difficulty?.level] || 'Medium',
      frontendId: p.stat.frontend_question_id,
      acRate: p.stat.total_acs && p.stat.total_submitted ? Math.round((p.stat.total_acs / p.stat.total_submitted) * 100) : 0,
    }))
    .sort((a: CatalogItem, b: CatalogItem) => a.frontendId - b.frontendId);

  rawSet('leetcode_cache', 'catalog', { items, fetchedAt: Date.now() });
  return items;
}

// Fetch problems by topic tag via LeetCode's current GraphQL (problemsetQuestionListV2).
// The old `problemsetQuestionList`/`tags` filter was removed; topics are now nested
// under filters.topicFilter.topicSlugs and difficulty comes back UPPERCASE.
const TOPIC_GQL_QUERY = `
  query topicProblems($skip: Int!, $limit: Int!, $tag: String!) {
    problemsetQuestionListV2(
      categorySlug: "all-code-essentials"
      limit: $limit
      skip: $skip
      filters: { filterCombineType: ALL, topicFilter: { topicSlugs: [$tag] } }
    ) {
      totalLength
      hasMore
      questions {
        questionFrontendId
        titleSlug
        title
        difficulty
        acRate
        paidOnly
      }
    }
  }
`;

const normalizeDiff = (d: string): 'Easy' | 'Medium' | 'Hard' => {
  const u = (d || '').toUpperCase();
  return u === 'EASY' ? 'Easy' : u === 'HARD' ? 'Hard' : 'Medium';
};

async function getCatalogByTopic(tag: string, pg: number, lim: number): Promise<{ items: CatalogItem[]; total: number }> {
  const skip = (pg - 1) * lim;
  const cacheKey = `topic:${tag}:${pg}:${lim}`;
  const cached = rawGet('leetcode_cache', cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return { items: cached.items, total: cached.total };

  const resp = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: LC_HEADERS,
    body: JSON.stringify({ query: TOPIC_GQL_QUERY, variables: { skip, limit: lim, tag } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`leetcode graphql ${resp.status}`);
  const json = (await resp.json()) as any;
  if (json?.errors) throw new Error(`leetcode gql: ${JSON.stringify(json.errors).slice(0, 160)}`);
  const list = json?.data?.problemsetQuestionListV2;
  if (!list) throw new Error('No data from LeetCode GraphQL');

  const items: CatalogItem[] = (list.questions || [])
    .filter((q: any) => !q.paidOnly)
    .map((q: any) => ({
      slug: q.titleSlug,
      title: q.title,
      difficulty: normalizeDiff(q.difficulty),
      frontendId: parseInt(q.questionFrontendId, 10) || 0,
      // V2 acRate may be a fraction (0–1) or a percent — normalize to whole percent.
      acRate: q.acRate ? Math.round(q.acRate > 1 ? q.acRate : q.acRate * 100) : 0,
    }));

  const total: number = list.totalLength || 0;
  rawSet('leetcode_cache', cacheKey, { items, total, fetchedAt: Date.now() });
  return { items, total };
}

// GET /problems?q=&difficulty=Easy&topic=array&page=1&limit=50  — paginated, searchable, filterable catalog
router.get('/problems', async (req: AuthRequest, res: Response) => {
  const { q = '', difficulty = '', topic = '', page = '1', limit = '50' } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit) || 50, 100);
  const pg = Math.max(parseInt(page) || 1, 1);

  try {
    if (topic) {
      // Topic-filtered path: use GraphQL (server-side pagination)
      const { items: rawItems, total } = await getCatalogByTopic(topic, pg, lim);
      const needle = q.trim().toLowerCase();
      let items = needle ? rawItems.filter(i => i.title.toLowerCase().includes(needle) || String(i.frontendId) === needle) : rawItems;
      if (difficulty) items = items.filter(i => i.difficulty === difficulty);

      return res.json({
        languages: LANGUAGES,
        source: 'leetcode',
        total,
        page: pg,
        pageSize: lim,
        hasMore: pg * lim < total,
        problems: items,
        featured: [],
      });
    }

    // Default path: full catalog
    let items = await getCatalog();
    const needle = q.trim().toLowerCase();
    if (needle) items = items.filter(i => i.title.toLowerCase().includes(needle) || String(i.frontendId) === needle);
    if (difficulty) items = items.filter(i => i.difficulty === difficulty);

    const slice = items.slice((pg - 1) * lim, pg * lim);

    res.json({
      languages: LANGUAGES,
      source: 'leetcode',
      total: items.length,
      page: pg,
      pageSize: lim,
      hasMore: pg * lim < items.length,
      problems: slice,
      featured: FALLBACK_PROBLEMS.map(p => ({ slug: p.id, title: p.title, difficulty: p.difficulty, topic: p.topic, featured: true })),
    });
  } catch {
    // Offline fallback — the curated runnable set
    res.json({
      languages: LANGUAGES,
      source: 'fallback',
      total: FALLBACK_PROBLEMS.length,
      page: 1,
      hasMore: false,
      problems: FALLBACK_PROBLEMS.map(p => ({ slug: p.id, title: p.title, difficulty: p.difficulty, frontendId: 0, acRate: 0 })),
      featured: [],
    });
  }
});

// GET /problem/:slug — full description, tags, and per-language starter code
router.get('/problem/:slug', async (req: AuthRequest, res: Response) => {
  const slug = req.params.slug;

  // Featured/curated problem?
  const fb = FALLBACK_PROBLEMS.find(p => p.id === slug);
  if (fb) {
    return res.json({
      slug, title: fb.title, difficulty: fb.difficulty, topic: fb.topic,
      prompt: fb.prompt, examples: fb.examples, hints: fb.hints, starter: fb.starter,
      featured: true, url: null,
    });
  }

  const cacheKey = `q:${slug}`;
  const cached = rawGet('leetcode_cache', cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 7 * 24 * 60 * 60 * 1000) return res.json(cached.detail);

  try {
    const query = `query q($t:String!){question(titleSlug:$t){questionFrontendId title difficulty content topicTags{name} hints codeSnippets{langSlug code} exampleTestcases}}`;
    const resp = await fetch('https://leetcode.com/graphql', {
      method: 'POST', headers: LC_HEADERS,
      body: JSON.stringify({ query, variables: { t: slug } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`leetcode gql ${resp.status}`);
    const json = (await resp.json()) as any;
    const qd = json?.data?.question;
    if (!qd) return res.status(404).json({ error: 'Problem not found' });

    // Map LeetCode snippet langSlugs → our runner language ids
    const SNIP: Record<string, string> = { python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp' };
    const starter: Record<string, string> = {};
    for (const s of qd.codeSnippets || []) {
      const id = SNIP[s.langSlug];
      if (id && !starter[id]) starter[id] = s.code;
    }

    const detail = {
      slug,
      title: qd.title,
      difficulty: qd.difficulty,
      topic: (qd.topicTags || []).map((t: any) => t.name).slice(0, 3).join(' · ') || 'Algorithms',
      prompt: qd.content || '',           // HTML
      promptIsHtml: true,
      hints: qd.hints || [],
      starter,
      url: `https://leetcode.com/problems/${slug}/`,
      featured: false,
    };
    rawSet('leetcode_cache', cacheKey, { detail, fetchedAt: Date.now() });
    res.json(detail);
  } catch (e: any) {
    res.status(502).json({ error: 'Could not load this problem from LeetCode.', detail: e?.message });
  }
});

// ─── Code execution: provider chain (self-hosted Piston → Wandbox) ───────────
router.post('/run', async (req: AuthRequest, res: Response) => {
  const { language, source, stdin } = req.body as { language?: string; source?: string; stdin?: string };
  const lang = LANGUAGES.find(l => l.id === language);
  if (!lang) return res.status(400).json({ error: 'Unsupported language' });
  if (!source || source.length > 50000) return res.status(400).json({ error: 'Invalid source' });
  const input = stdin || '';

  const errors: string[] = [];

  // 1) Self-hosted Piston if configured (best for production — unlimited & free)
  const pistonUrl = process.env.PISTON_URL;
  if (pistonUrl) {
    try {
      const r = await runViaPiston(pistonUrl.replace(/\/$/, ''), lang, source, input);
      return res.json({ ...r, output: (r.stdout + (r.stderr ? `\n${r.stderr}` : '')).trim() || '(no output)', language: lang.id });
    } catch (e: any) { errors.push(`piston: ${e?.message}`); }
  }

  // 2) Wandbox public API (works with no setup)
  try {
    const r = await runViaWandbox(lang, source, input);
    return res.json({ ...r, output: (r.stdout + (r.stderr ? `\n${r.stderr}` : '')).trim() || '(no output)', language: lang.id });
  } catch (e: any) { errors.push(`wandbox: ${e?.message}`); }

  res.status(502).json({
    error: 'No code runner available right now.',
    hint: 'JavaScript still runs in-browser. For unlimited multi-language execution, set PISTON_URL to a self-hosted Piston (see docker-compose).',
    detail: errors.join(' | '),
  });
});

export default router;
