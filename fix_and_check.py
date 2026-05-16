import re

with open('src/content/blog/pg-isolation-locking.md', 'r') as f:
    lines = f.readlines()

# Fix 1: Add <div class="hero"> at line 18
lines.insert(17, '<div class="hero">\n')

# Fix 2: Replace lines 1101-1102 (which are now 1102-1103 due to insertion)
# Original lines:
# 1101|
# 1102|
# 1103|    <div class="perf" style="color: var(--accent3)">Default</div>
# Let's find the exact index
for i, line in enumerate(lines):
    if 'Default</div>' in line and 'perf' in line:
        idx = i
        break

lines[idx-2] = '<div class="summary-grid">\n'
lines[idx-1] = '  <div class="summary-card">\n    <div class="level">READ COMMITTED</div>\n'

# Fix 3: Remove lines 1169 and 1172 (which will be shifted)
# Let's find them from the bottom
to_remove = []
for i in range(len(lines)-1, -1, -1):
    if lines[i].strip() == '</div>':
        to_remove.append(i)
        if len(to_remove) == 2:
            break

for i in to_remove:
    del lines[i]

# Now check balance
stack = []
for i, line in enumerate(lines):
    div_opens = [m.start() for m in re.finditer(r'<div\b', line)]
    div_closes = [m.start() for m in re.finditer(r'</div\b', line)]
    
    for _ in div_opens:
        stack.append(i + 1)
    for _ in div_closes:
        if stack:
            stack.pop()
        else:
            print(f"Extra </div> at line {i + 1}")

print(f"Remaining open divs: {len(stack)}")
